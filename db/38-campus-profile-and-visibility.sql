-- Campus Onboarding, phase 2: link students to the campus they registered
-- under (so each campus gets a real, auto-updating "how many of our
-- students signed up on the main site" count) + an admin-controlled
-- visibility toggle so a subdomain can be hidden/blocked without deleting
-- the underlying request/provisioning record.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarded_campus_id uuid REFERENCES public.campus_onboard_requests(id) ON DELETE SET NULL;

ALTER TABLE public.campus_onboard_requests
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

-- Public listing/detail pages must respect is_visible even for approved
-- campuses (admin "hide" action) -- previously any approved row was public.
DROP POLICY IF EXISTS "Public reads approved campuses" ON public.campus_onboard_requests;
CREATE POLICY "Public reads approved campuses" ON public.campus_onboard_requests
  FOR SELECT
  USING (
    (status = 'approved' AND is_visible = true)
    OR auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

-- Students self-selecting "I belong to this campus" is a normal profile
-- edit already covered by the existing "Users update own profile" policy
-- (id = auth.uid()) -- no new policy needed, just documenting the intent
-- here since it's a new column on an existing table.
