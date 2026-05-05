1. Fix profile photo rendering and avatar upload UX

- Update the settings/profile avatar rendering so Cloudinary URLs display reliably instead of failing for some uploaded images.
- Remove the technical storage-path helper text (“Stored as users/... on Cloudinary”) from the user-facing settings card.
- Keep the upload action, preview, and fallback initial intact.
- Reuse the same safe avatar rendering approach in the main profile header and relevant admin/student views where broken avatar display can also happen.

2. Relax and correct profile completeness logic

- Rewrite `useProfileCompleteness` so 100% can be reached with the actually important student fields only.
- Remove Public Profile and Social Links from completeness calculation.
- Stop requiring extra role-detail fields for students.
- Make role-dependent requirements conditional only for business/job users.
- Treat username as complete when it already exists or is auto-generated during backfill.
- Keep the completeness widget and settings page in sync with the same rules.

3. Fix settings form behavior for username and role-based fields

- Ensure the username is auto-generated for users who still have it blank, instead of showing an empty permanent field.
- Update the settings page so student users do not see business/job-specific designation/current job inputs.
- Show those fields only when the selected role needs them.
- Preserve existing data for employee/businessman roles while hiding irrelevant inputs for students.

4. Backfill missing usernames in the database

- Add a migration that safely generates unique usernames for existing users whose `user_profiles.username` is null/blank.
- Use a deterministic slug from full name, with uniqueness fallback when needed.
- Also update the signup trigger/function so future accounts always receive a username even if signup metadata does not include one.
- This addresses the current data issue I found: many existing profiles are missing usernames, so the UI cannot show them.

5. Add real admin-visible login information

- Create a proper public-side tracking field/table for login visibility, because the current admin UI is not showing true login data.
- Right now the app shows `updated_at` as “Last active”, which is not login information.
- Add a migration to store last successful login timestamp per user in a public table/column that admins can read through RLS-safe policies.
- Update the auth/session flow to write that login timestamp after a successful authenticated session is established.
- Surface this in admin screens such as Admin Users / Student Detail as “Last login” instead of the misleading “Last active”.

Technical details

- Files likely to update:
  - `src/pages/dashboard/SettingsPage.tsx`
  - `src/pages/Profile.tsx`
  - `src/hooks/useProfileCompleteness.ts`
  - `src/hooks/useAuth.tsx`
  - `src/pages/admin/AdminUsers.tsx`
  - `src/pages/admin/StudentDetail.tsx`
  - optionally shared avatar/image helpers for consistency
- Database work:
  - new migration to backfill/generate usernames for existing users
  - update `handle_new_user()` to auto-generate username when metadata username is absent
  - new migration for admin-visible last-login storage and policies if needed
- Important findings from inspection:
  - The settings page currently hardcodes storage text under the avatar upload UI.
  - The completeness hook currently includes Public Profile + Social Links and counts role details too strictly.
  - Student role currently still sees designation/current-job inputs.
  - 206 existing profiles are missing usernames.
  - Admin login visibility is not implemented correctly today; `StudentDetail` is showing `updated_at` as “Last active”, which is misleading and not actual login data.

If you approve, I’ll implement the code changes plus the required database migration(s).

&nbsp;

yes i am approving all of these implement this and then run for all profile , for preventing the all of issue . 