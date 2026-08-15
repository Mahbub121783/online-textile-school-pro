-- The original "Admins manage campus onboard requests" policy (db/35) was
-- created FOR UPDATE only, so admins could never DELETE a campus request --
-- discovered while cleaning up leftover test rows during subdomain-tracking
-- work. Widen it to FOR ALL (covers DELETE too) so a "Delete Request" action
-- is actually usable in the admin UI.
DROP POLICY IF EXISTS "Admins manage campus onboard requests" ON public.campus_onboard_requests;
CREATE POLICY "Admins manage campus onboard requests" ON public.campus_onboard_requests
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );
