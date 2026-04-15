

# Instructor Management — Deep Feature Audit & Fixes

## Issues Found

### 1. CommunicationsTab: "Dispatch Official Mark" is Fake
`handleDispatchMark()` (line 87-98) only shows a toast — it does NOT save anything to the database. No grade record is created, no notification is sent to the student. Completely non-functional.

**Fix**: Look up student by roll_id or email, find their enrollment in the selected course, upsert into `gradebook_entries` table, and send them a notification.

### 2. CommunicationsTab: Email Toggle is Ignored
The `sendViaEmail` state is set by the Switch but never read in `handleSendNotification()`. When email is toggled on, notifications still only go in-app.

**Fix**: When `sendViaEmail` is true, use `broadcastNotificationWithEmail` / `createNotificationWithEmail` instead of the non-email variants.

### 3. AccessBoardTab: "Reset Password" is Fake
The Reset Password dropdown item (line 174-176) only shows a toast saying "A reset link has been sent" but does NOT actually trigger any password reset. This is misleading.

**Fix**: Cannot call `supabase.auth.admin.resetPasswordForEmail` from client (requires service role). Instead, look up the instructor's email from `instructor_applications` or use a lightweight edge function. For now, use the `send-smtp-email` edge function to send a password reset link via `supabase.auth.resetPasswordForEmail` (which works from the client for the anon key).

### 4. AccessBoardTab: No "Remove Instructor Role" Option
Admins can suspend accounts and revoke courses, but cannot demote an instructor back to student-only. This is a critical access control gap.

**Fix**: Add a "Remove Instructor Role" dropdown item that deletes the `user_roles` entry where `role = 'instructor'`.

### 5. ApprovalsTab: No Notification on Approve/Reject
When an instructor application is approved or rejected, no notification is sent to the applicant. They have no way to know the outcome.

**Fix**: After approval, create a notification for the user. After rejection, create a notification with the reason.

### 6. FinancialsTab: Withdrawal Rejection Doesn't Notify Instructor
When a withdrawal is rejected, the request is silently deleted with no notification to the instructor.

**Fix**: Send a notification to the instructor when their withdrawal is rejected, including the reason.

### 7. AccessBoardTab: Revenue Shows `$` Instead of `৳`
The revenue column uses `$` (line 149) while the rest of the app uses `৳` (Bangladeshi Taka).

**Fix**: Change to `৳`.

## Implementation Plan

### Files Modified

1. **`src/pages/admin/instructor-management/CommunicationsTab.tsx`**
   - Wire `handleDispatchMark` to actually look up the student (by roll_id or email), upsert a `gradebook_entries` record, and send a notification
   - Use `sendViaEmail` toggle to call email-enabled notification functions when toggled on

2. **`src/pages/admin/instructor-management/AccessBoardTab.tsx`**
   - Replace fake "Reset Password" with real `supabase.auth.resetPasswordForEmail()` call (works from client)
   - Add "Remove Instructor Role" dropdown item that deletes the role and sends a notification
   - Fix currency symbol from `$` to `৳`

3. **`src/pages/admin/instructor-management/ApprovalsTab.tsx`**
   - After approve mutation succeeds: send notification to applicant's user_id ("Your instructor application has been approved!")
   - After reject mutation succeeds: send notification with admin notes as reason

4. **`src/pages/admin/instructor-management/FinancialsTab.tsx`**
   - After withdrawal rejection: send notification to the instructor with the rejection reason

## Technical Details

- All notifications use existing `createNotification` from `@/lib/notifications`
- Password reset uses `supabase.auth.resetPasswordForEmail(email)` which requires knowing the email — will fetch from `instructor_applications` table
- Grade dispatch uses existing `gradebook_entries` table with upsert on `(student_id, course_id)`
- No database migrations needed — all tables already exist

