-- Campus Onboarding, phase 3: logo, department list, and letting admins
-- fully edit a campus's own subdomain content (not just approve/reject).
SELECT set_config('request.jwt.claim.role', 'service_role', false);

ALTER TABLE public.campus_onboard_requests
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS departments text[] DEFAULT '{}'::text[];

-- Admins were already allowed to UPDATE any column via the existing
-- "Admins manage campus onboard requests" policy -- no RLS change needed
-- for logo_url/departments, just documenting that the deep-edit capability
-- the user asked for was already covered by that policy.
