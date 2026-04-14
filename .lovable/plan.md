

# Fix Institutional Email System — Admin Access, Email Format & Improvements

## Issues Found

1. **No EduMail/Email Requests link in Admin sidebar** — The "Email Requests" item exists under Setup but there's no dedicated "EduMail" management entry visible to admin/super_admin like students have.
2. **Wrong email format** — Current: `md_mahbubul_alam_033@onlinetextileschool.com`. Expected: `mahbub033@onlinetextileschool.com` (first name + last 3 digits of roll ID, no underscores between them).
3. **Admin/Super Admin access parity** — Need to verify both roles can access all email management features.

## What Will Be Changed

### 1. Fix Email Format (All 3 files)
Change `generateEmail()` in `InstitutionalEmailWidget.tsx`, `EduMailPage.tsx`, and the edge function to use:
- Extract first name only (first word of full_name)
- Append last 3 digits of roll_id directly (no underscore separator)
- Result: `mahbub033@onlinetextileschool.com`

### 2. Add EduMail Management to Admin Sidebar
- Add a top-level "EduMail" item under the Setup section or as a standalone visible item in `AdminSidebar.tsx` so admins can easily find it
- Ensure both `admin` and `super_admin` roles can access `/admin/email-requests`

### 3. Enhance Admin Email Requests Page
- Add user's personal email display (fetch from `auth.users` via profiles or show the user's registered email)
- Add summary stats cards at top (total, pending, active, blocked, expired counts)
- Improve the detail modal with more comprehensive info

### 4. Edge Function — Update Email Format on Approve
- When auto-generating email on approval, use the corrected format: `firstname` + `last3rolldigits` (no underscore)

## Files to Modify

1. **`src/components/InstitutionalEmailWidget.tsx`** — Fix `generateEmail()` format
2. **`src/pages/dashboard/EduMailPage.tsx`** — Fix `generateEmail()` format
3. **`supabase/functions/cpanel-email-provisioner/index.ts`** — No change needed (uses `requested_email` from DB)
4. **`src/components/layout/AdminSidebar.tsx`** — Make EduMail/Email Requests more prominent
5. **`src/pages/admin/AdminEmailRequests.tsx`** — Add stats cards, personal email column, enhanced detail modal

## Technical Details

- Email format: `firstName + rollIdLast3 + @onlinetextileschool.com`
- Example: full_name="Md Mahbubul Alam", roll_id="OTS-123033" → `mahbub033@onlinetextileschool.com`
- First name extraction: take first word, lowercase, remove non-alphanumeric chars
- Both admin and super_admin roles already have RLS access; just need UI routing confirmation

