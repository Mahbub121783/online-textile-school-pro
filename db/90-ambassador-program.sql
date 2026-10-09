-- Campus Ambassador Program:
--  - Current Role gains 'instructor' (descriptive only -- the real
--    instructor-approval workflow at /admin/instructors is unrelated and
--    untouched) and 'ambassador' (triggers a real application below).
--  - ambassador_sessions: admin-managed lookup (e.g. "Spring 2026") that
--    applicants pick from -- they never free-type it.
--  - ambassador_applications: one row per user. sub_role is
--    head_of_campus / ambassador / graphics_team. campus_id links to an
--    *approved* campus_onboard_requests row (graphics_team has none --
--    that track isn't campus-tied). Admin approves/rejects and can adjust
--    points directly (plain UPDATE under the same staff RLS used
--    everywhere else here, no edge function needed -- there's no external
--    side effect to orchestrate, unlike campus-approve's subdomain
--    provisioning).
--  - Approved head_of_campus / ambassador rows get the same manage access
--    to their linked campus (posts/notices/gallery/events/fabric-library)
--    that the campus's own submitted_by owner has. graphics_team does not
--    (no campus_id, nothing to grant). This replaces the repeated
--    "c.submitted_by = auth.uid()" ownership check across every campus_*
--    RLS policy with public.is_campus_owner_or_ambassador(campus_id, uid),
--    which ORs in the ambassador path without changing owner behavior.
--
-- Deliberately NOT built yet (explicitly deferred by the requester):
--  - Daily activity logging for approved ambassadors.
--  - Point-redemption-for-features mechanics -- points are tracked and
--    shown, but nothing consumes them yet.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

CREATE TYPE public.ambassador_sub_role AS ENUM ('head_of_campus', 'ambassador', 'graphics_team');
CREATE TYPE public.ambassador_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.ambassador_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ambassador_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sub_role public.ambassador_sub_role NOT NULL,
  campus_id uuid REFERENCES public.campus_onboard_requests(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.ambassador_sessions(id) ON DELETE SET NULL,
  status public.ambassador_status NOT NULL DEFAULT 'pending',
  points integer NOT NULL DEFAULT 0,
  applied_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  CONSTRAINT ambassador_campus_required_unless_graphics
    CHECK (sub_role = 'graphics_team' OR campus_id IS NOT NULL)
);

CREATE INDEX idx_ambassador_applications_campus ON public.ambassador_applications(campus_id);
CREATE INDEX idx_ambassador_applications_status ON public.ambassador_applications(status);

ALTER TABLE public.ambassador_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_applications FORCE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active ambassador sessions" ON public.ambassador_sessions
  FOR SELECT USING (
    is_active = true OR auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  );
CREATE POLICY "Admins manage ambassador sessions" ON public.ambassador_sessions
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  ) WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  );

CREATE POLICY "Signed-in users submit their own ambassador application" ON public.ambassador_applications
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND user_id = auth.uid() AND status = 'pending' AND points = 0)
  );
CREATE POLICY "Users read their own application, staff read all, public reads approved" ON public.ambassador_applications
  FOR SELECT USING (
    status = 'approved'
    OR auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  );
CREATE POLICY "Applicant resubmits after rejection, staff manage all" ON public.ambassador_applications
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR (user_id = auth.uid() AND status = 'rejected')))
  ) WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR (user_id = auth.uid() AND status = 'pending')))
  );
CREATE POLICY "Staff delete ambassador applications" ON public.ambassador_applications
  FOR DELETE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  );

-- Shared helper: is this uid allowed to manage this campus's content --
-- either the original submitter, or an approved campus-tied ambassador.
CREATE OR REPLACE FUNCTION public.is_campus_owner_or_ambassador(_campus_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = _campus_id AND c.submitted_by = _uid
  ) OR EXISTS (
    SELECT 1 FROM public.ambassador_applications aa
    WHERE aa.campus_id = _campus_id AND aa.user_id = _uid AND aa.status = 'approved'
      AND aa.sub_role IN ('head_of_campus', 'ambassador')
  )
$$;

-- campus_onboard_requests: the owner-management policy
DROP POLICY IF EXISTS "Admins and owners manage campus onboard requests" ON public.campus_onboard_requests;
CREATE POLICY "Admins and owners manage campus onboard requests" ON public.campus_onboard_requests
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR public.is_campus_owner_or_ambassador(id, auth.uid())))
  ) WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR public.is_campus_owner_or_ambassador(id, auth.uid())))
  );

-- campus_events
DROP POLICY IF EXISTS "Owners and admins manage campus events" ON public.campus_events;
CREATE POLICY "Owners and admins manage campus events" ON public.campus_events
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR public.is_campus_owner_or_ambassador(campus_id, auth.uid())))
  ) WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR public.is_campus_owner_or_ambassador(campus_id, auth.uid())))
  );
DROP POLICY IF EXISTS "Public reads active campus events" ON public.campus_events;
CREATE POLICY "Public reads active campus events" ON public.campus_events
  FOR SELECT USING (
    (is_active = true AND EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_events.campus_id AND c.status = 'approved' AND c.is_visible = true))
    OR auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR public.is_campus_owner_or_ambassador(campus_id, auth.uid())))
  );

-- campus_notices
DROP POLICY IF EXISTS "Owners and admins manage campus notices" ON public.campus_notices;
CREATE POLICY "Owners and admins manage campus notices" ON public.campus_notices
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR public.is_campus_owner_or_ambassador(campus_id, auth.uid())))
  ) WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR public.is_campus_owner_or_ambassador(campus_id, auth.uid())))
  );
DROP POLICY IF EXISTS "Public reads active campus notices" ON public.campus_notices;
CREATE POLICY "Public reads active campus notices" ON public.campus_notices
  FOR SELECT USING (
    (is_active = true AND EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_notices.campus_id AND c.status = 'approved' AND c.is_visible = true))
    OR auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR public.is_campus_owner_or_ambassador(campus_id, auth.uid())))
  );

-- campus_gallery_images
DROP POLICY IF EXISTS "Owners and admins delete campus gallery photos" ON public.campus_gallery_images;
CREATE POLICY "Owners and admins delete campus gallery photos" ON public.campus_gallery_images
  FOR DELETE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (public.is_campus_owner_or_ambassador(campus_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  );
DROP POLICY IF EXISTS "Linked students and owners add campus gallery photos" ON public.campus_gallery_images;
CREATE POLICY "Linked students and owners add campus gallery photos" ON public.campus_gallery_images
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND uploaded_by = auth.uid() AND (
      EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.onboarded_campus_id = campus_gallery_images.campus_id)
      OR public.is_campus_owner_or_ambassador(campus_id, auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
    ))
  );
DROP POLICY IF EXISTS "Public reads campus gallery" ON public.campus_gallery_images;
CREATE POLICY "Public reads campus gallery" ON public.campus_gallery_images
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_gallery_images.campus_id AND (
        (c.status = 'approved' AND c.is_visible = true)
        OR (auth.role() = 'authenticated' AND (public.is_campus_owner_or_ambassador(c.id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
      )
    )
  );

-- campus_fabric_libraries
DROP POLICY IF EXISTS "Owners and admins update campus fabric libraries" ON public.campus_fabric_libraries;
CREATE POLICY "Owners and admins update campus fabric libraries" ON public.campus_fabric_libraries
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR public.is_campus_owner_or_ambassador(campus_id, auth.uid())))
  ) WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR (public.is_campus_owner_or_ambassador(campus_id, auth.uid()) AND campus_id = campus_id AND NOT (created_by IS DISTINCT FROM created_by))))
  );
DROP POLICY IF EXISTS "Public reads campus fabric libraries" ON public.campus_fabric_libraries;
CREATE POLICY "Public reads campus fabric libraries" ON public.campus_fabric_libraries
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_fabric_libraries.campus_id AND (
        (c.status = 'approved' AND c.is_visible = true)
        OR (auth.role() = 'authenticated' AND (public.is_campus_owner_or_ambassador(c.id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
      )
    )
  );

-- campus_fabric_library_photos
DROP POLICY IF EXISTS "Owners and admins delete fabric library photos" ON public.campus_fabric_library_photos;
CREATE POLICY "Owners and admins delete fabric library photos" ON public.campus_fabric_library_photos
  FOR DELETE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (public.is_campus_owner_or_ambassador(campus_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  );
DROP POLICY IF EXISTS "Owners and admins add fabric library photos" ON public.campus_fabric_library_photos;
CREATE POLICY "Owners and admins add fabric library photos" ON public.campus_fabric_library_photos
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND uploaded_by = auth.uid() AND (public.is_campus_owner_or_ambassador(campus_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  );
DROP POLICY IF EXISTS "Public reads fabric library photos" ON public.campus_fabric_library_photos;
CREATE POLICY "Public reads fabric library photos" ON public.campus_fabric_library_photos
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_fabric_library_photos.campus_id AND (
        (c.status = 'approved' AND c.is_visible = true)
        OR (auth.role() = 'authenticated' AND (public.is_campus_owner_or_ambassador(c.id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
      )
    )
  );

-- campus_fabric_hanger_distributions
DROP POLICY IF EXISTS "Owners and admins confirm fabric distribution receipt" ON public.campus_fabric_hanger_distributions;
CREATE POLICY "Owners and admins confirm fabric distribution receipt" ON public.campus_fabric_hanger_distributions
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR public.is_campus_owner_or_ambassador(campus_id, auth.uid())))
  ) WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR (public.is_campus_owner_or_ambassador(campus_id, auth.uid()) AND quantity = quantity AND hanger_id = hanger_id AND campus_id = campus_id AND distributed_at = distributed_at)))
  );
DROP POLICY IF EXISTS "Public reads campus fabric distributions" ON public.campus_fabric_hanger_distributions;
CREATE POLICY "Public reads campus fabric distributions" ON public.campus_fabric_hanger_distributions
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_fabric_hanger_distributions.campus_id AND (
        (c.status = 'approved' AND c.is_visible = true)
        OR (auth.role() = 'authenticated' AND (public.is_campus_owner_or_ambassador(c.id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
      )
    )
  );

\echo '--- sanity: new tables + helper exist ---'
SELECT count(*) AS ambassador_tables FROM information_schema.tables WHERE table_name IN ('ambassador_sessions', 'ambassador_applications');
SELECT proname FROM pg_proc WHERE proname = 'is_campus_owner_or_ambassador';
