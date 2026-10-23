SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','f49d6153-1835-4455-81f3-2918d5d3484e',false);

-- "Admins manage registrations" had no service_role bypass -- same class of
-- gap as referral_rewards (db/94) -- harmless today since no backend code
-- queries this table with serviceQuery yet, but fixed now for consistency
-- with every comparable table, found while debugging the public
-- registration form.
DROP POLICY IF EXISTS "Admins manage registrations" ON public.registrations;
CREATE POLICY "Admins manage registrations" ON public.registrations
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );
