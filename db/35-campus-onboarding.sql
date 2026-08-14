-- New feature: Campus Onboarding. Public registration for a physical
-- campus/partner to join the platform (facilities, student count, area),
-- admin review queue with approve/reject, a public list of approved
-- campuses, and (on approval) an admin-triggered action to provision a
-- real subdomain for that campus, reusing the existing site's docroot so
-- no extra Node process / deployment is needed per campus.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

CREATE TABLE IF NOT EXISTS public.campus_onboard_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_name text NOT NULL,
  area text NOT NULL,
  facilities text,
  student_count integer,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  description text,
  subdomain_slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  rejection_reason text,
  reviewed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  submitted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  subdomain_provisioned boolean NOT NULL DEFAULT false,
  subdomain_provisioned_at timestamptz,
  subdomain_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campus_onboard_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_onboard_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit a campus onboard request" ON public.campus_onboard_requests;
CREATE POLICY "Anyone can submit a campus onboard request" ON public.campus_onboard_requests
  FOR INSERT
  WITH CHECK (
    campus_name IS NOT NULL AND length(btrim(campus_name)) > 0
    AND contact_email IS NOT NULL AND length(btrim(contact_email)) > 0
  );

DROP POLICY IF EXISTS "Public reads approved campuses" ON public.campus_onboard_requests;
CREATE POLICY "Public reads approved campuses" ON public.campus_onboard_requests
  FOR SELECT
  USING (
    status = 'approved'
    OR auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

DROP POLICY IF EXISTS "Admins manage campus onboard requests" ON public.campus_onboard_requests;
CREATE POLICY "Admins manage campus onboard requests" ON public.campus_onboard_requests
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

DROP TRIGGER IF EXISTS trg_campus_onboard_requests_updated ON public.campus_onboard_requests;
CREATE TRIGGER trg_campus_onboard_requests_updated
BEFORE UPDATE ON public.campus_onboard_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
