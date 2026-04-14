

# Automated Institutional Email System via cPanel API

## Overview

Build a complete system where students/instructors can request an institutional email (`name_roll_last3digits@onlinetextileschool.com`), and admins can approve/reject requests. On approval, the system auto-creates the email account via cPanel UAPI and notifies the user with their credentials.

## Architecture

```text
Student/Instructor                Admin Panel                  Edge Function
  ┌─────────┐                   ┌──────────┐               ┌──────────────┐
  │ Request  │──insert row──▶   │ Review & │──approve──▶   │ cpanel-email │
  │ Email    │                   │ Approve  │               │ -provisioner │
  │ Button   │                   │ or Reject│               │              │
  └─────────┘                   └──────────┘               │ 1. Call cPanel│
                                                            │    UAPI      │
                                                            │ 2. Update DB │
                                                            │ 3. Send SMTP │
                                                            │    with creds│
                                                            └──────────────┘
```

## What Will Be Built

### 1. Database Migration — `institutional_email_requests` table
- `id`, `user_id` (FK to auth.users), `requested_email`, `generated_password`, `status` (pending/approved/rejected/failed), `admin_notes`, `approved_by`, `created_at`, `approved_at`
- RLS policies for students to insert/read own rows, admins to manage all

### 2. Supabase Secrets
- `CPANEL_API_TOKEN` = `T0OII5ISCFUC6QHSV3JYKMSAPM0GNGG7`
- `CPANEL_USERNAME` = `tecnedub`
- `CPANEL_HOSTNAME` = `premium.us10.svlogins.com`

### 3. Edge Function — `cpanel-email-provisioner`
- Receives `{ requestId, action: 'approve' | 'reject' }`
- On approve: generates a secure password, calls cPanel UAPI `Email::add_pop` to create the email account, updates DB row with credentials, sends notification email via existing SMTP system with the new email + password
- On reject: updates status, optionally sends rejection notification
- Email format: `firstname_rollid_last3digits@onlinetextileschool.com` (auto-generated from user profile)

### 4. Student Dashboard — "Request Institutional Email" button
- Added to the student Settings page or as a new card on Dashboard Overview
- Shows current status if already requested (pending/approved with email shown)
- Simple form with a "Request Email" button (email is auto-generated from profile data)

### 5. Instructor Dashboard — Same feature for instructors
- Added to instructor settings, same request flow

### 6. Admin Panel — Email Requests Management Page
- New page at `/admin/email-requests` with sidebar link under Setup section
- Table showing all requests with user name, roll ID, requested email, status, date
- Approve/Reject buttons with confirmation dialog
- View provisioned email details
- Filter by status (pending/approved/rejected)

### 7. Notification Emails
- On approval: email sent to user's personal email with their new institutional email + password
- On rejection: email sent with admin notes explaining why

## Technical Details

- cPanel UAPI endpoint: `https://premium.us10.svlogins.com:2083/execute/Email/add_pop`
- Auth header: `Authorization: cpanel tecnedub:T0OII5ISCFUC6QHSV3JYKMSAPM0GNGG7`
- Email domain: `onlinetextileschool.com`
- Password: auto-generated 12-char alphanumeric
- The generated password is encrypted/hashed before storing in DB (only sent once via email)

## Files to Create/Modify

1. **New migration** — `institutional_email_requests` table + RLS
2. **New edge function** — `supabase/functions/cpanel-email-provisioner/index.ts`
3. **New admin page** — `src/pages/admin/AdminEmailRequests.tsx`
4. **New student component** — institutional email request widget
5. **Modify** `src/App.tsx` — add route for admin email requests page
6. **Modify** `src/components/layout/AdminSidebar.tsx` — add sidebar link
7. **Modify** `src/components/layout/DashboardSidebar.tsx` — add link
8. **Modify** `src/components/layout/InstructorSidebar.tsx` — add link
9. **Modify** `src/pages/dashboard/SettingsPage.tsx` — add email request section
10. **Add 3 Supabase secrets** — CPANEL_API_TOKEN, CPANEL_USERNAME, CPANEL_HOSTNAME

