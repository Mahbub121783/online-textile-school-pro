

# Advanced Institutional Email Management System

## Overview

Upgrade the institutional email system with full admin management capabilities, 6-month auto-validity tied to course enrollments (like the ID card system), a dedicated student "EduMail" tab, and comprehensive admin controls (block, reset password, view usage, see user emails on Students page).

## What Will Be Built

### 1. Database Migration — Add new columns to `institutional_email_requests`

Add columns to support validity, blocking, and password reset tracking:
- `valid_from` (timestamptz) — when email was activated
- `valid_until` (timestamptz) — auto-calculated expiry (6 months per enrollment)
- `is_blocked` (boolean, default false) — admin can block/unblock
- `blocked_at` (timestamptz)
- `last_password_reset_at` (timestamptz)
- `current_password` (text, encrypted) — stored for admin visibility
- `email_quota_mb` (integer, default 512)

### 2. Edge Function Updates — `cpanel-email-provisioner`

Add new actions beyond approve/reject:
- `block` — Suspend email via cPanel UAPI (`Email::suspend_login`)
- `unblock` — Unsuspend via cPanel UAPI (`Email::unsuspend_login`)
- `reset-password` — Generate new password via cPanel UAPI (`Email::passwd_pop`), send to user
- `delete` — Delete expired accounts via cPanel UAPI (`Email::delete_pop`)
- `check-usage` — Query disk usage via cPanel UAPI (`Email::get_disk_usage`)
- On approve: set `valid_from` = now, calculate `valid_until` based on paid enrollments (6 months each)

### 3. Auto-Validity System (like ID cards)

Create `src/lib/ensureEmailValidity.ts`:
- When a new paid enrollment happens, extend `valid_until` by 6 months
- When `valid_until` passes, auto-set status to `expired` (via a scheduled check or on-access check)
- Mirror the `ensureStudentIdCard.ts` pattern exactly

### 4. Admin Email Requests Page — Major Upgrade

Enhance `AdminEmailRequests.tsx` with:
- Show user's personal email alongside institutional email
- Block/Unblock toggle per approved email
- "Reset Password" button (generates new password, emails to user)
- "View Usage" showing mailbox size
- Validity period display with expiry countdown
- Status for `expired` emails
- Bulk actions (block multiple, delete expired)
- Detail modal showing full email info, IMAP/SMTP settings, activity log

### 5. Admin Students Page — Show Institutional Email

In `AdminStudents.tsx`:
- Add a column showing the user's institutional email (if any) with status badge
- Quick-link to manage that email from the students table

### 6. Student Dashboard — New "EduMail" Tab

Add a dedicated `/dashboard/edumail` page:
- Full-page institutional email hub (not just a small widget)
- Show email address, status, validity period with progress bar
- Webmail quick-launch button
- IMAP/SMTP configuration details card
- Email usage/quota display
- Password info (last reset date)
- Request button if no email exists yet
- Expiry warning when < 30 days remaining

### 7. Sidebar & Routing Updates

- Add "EduMail" nav item to `DashboardSidebar.tsx` and `InstructorSidebar.tsx`
- Add `/dashboard/edumail` route in `App.tsx`
- Add `expired` status handling throughout

## Files to Create/Modify

1. **New migration** — Add columns (`valid_from`, `valid_until`, `is_blocked`, `current_password`, etc.) + `expired` status
2. **Edit** `supabase/functions/cpanel-email-provisioner/index.ts` — Add block/unblock/reset-password/delete/check-usage actions + validity calculation on approve
3. **Create** `src/lib/ensureEmailValidity.ts` — Auto-extend validity on enrollment (mirrors `ensureStudentIdCard.ts`)
4. **Create** `src/pages/dashboard/EduMailPage.tsx` — Full student EduMail dashboard tab
5. **Edit** `src/pages/admin/AdminEmailRequests.tsx` — Add block, reset password, usage, validity, personal email display, bulk actions
6. **Edit** `src/pages/admin/AdminStudents.tsx` — Show institutional email column
7. **Edit** `src/components/layout/DashboardSidebar.tsx` — Add EduMail nav item
8. **Edit** `src/components/layout/InstructorSidebar.tsx` — Add EduMail nav item
9. **Edit** `src/App.tsx` — Add EduMail route
10. **Edit** `src/components/InstitutionalEmailWidget.tsx` — Add validity display + expiry warning

## Technical Details

- cPanel UAPI endpoints used: `Email/add_pop`, `Email/suspend_login`, `Email/unsuspend_login`, `Email/passwd_pop`, `Email/delete_pop`, `Email/get_disk_usage`
- Validity calculation: 6 months per paid enrollment, auto-extended when new courses are purchased (same logic as `ensureStudentIdCard.ts`)
- Password stored encrypted in DB for admin visibility; also sent to user via SMTP on creation/reset
- Expired emails are soft-deleted (status changed, cPanel account suspended), not hard-deleted immediately

