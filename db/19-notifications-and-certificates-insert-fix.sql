-- notifications INSERT was service_role-only, but the shared
-- src/lib/notifications.ts createNotification() helper -- used across
-- dozens of call sites platform-wide (assignment grading, course
-- approve/reject, certificate issuance, grade publishing, announcements,
-- etc.) -- does a plain client-side supabase.from('notifications').insert()
-- as whichever user is logged in (student/instructor/admin). Every single
-- one of those has been silently failing (error swallowed by
-- console.error, never surfaced to the user). Confirmed live: an admin's
-- own JWT was rejected inserting a notification for another user.
-- Notifications are low-sensitivity (title/message/link only, no
-- financial/security impact), so allow any authenticated user to create one
-- for any user_id -- matching what the pre-existing client code across the
-- whole app has always assumed.
DROP POLICY IF EXISTS "Authenticated users create notifications" ON public.notifications;
CREATE POLICY "Authenticated users create notifications" ON public.notifications
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- certificates INSERT already correctly requires service_role/admin/
-- instructor/super_admin -- but auto-issuance (useEnrollments.ts
-- autoIssueCertificate(), fires when a student's own lesson-completion push
-- their progress to 100%) ran under the STUDENT's own session, which this
-- policy (correctly) rejects -- meaning the entire "auto-issue certificate on
-- course completion" feature has been silently broken for every student.
-- Rather than loosen this policy (which would let a student forge arbitrary
-- certificates for themselves), issuance moves to a new server-side
-- endpoint (backend/src/functions/issueCertificate.js) that verifies
-- completion/score eligibility itself and issues via serviceQuery -- no
-- RLS change needed here at all, this policy stays exactly as it was.
