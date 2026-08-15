-- Campus Onboard expansion: a notice board (entirely new -- no prior table),
-- and more "high profile" fields on campus_onboard_requests so a campus's
-- public portfolio can show more than just name/area/facilities.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

ALTER TABLE public.campus_onboard_requests
  ADD COLUMN IF NOT EXISTS established_year integer,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS full_address text,
  ADD COLUMN IF NOT EXISTS campus_type text,
  ADD COLUMN IF NOT EXISTS highlights text[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.campus_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campus_onboard_requests(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  posted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campus_notices_campus_id ON public.campus_notices(campus_id);
ALTER TABLE public.campus_notices ENABLE ROW LEVEL SECURITY;

-- Same ownership pattern as campus_gallery_images (db/47): public sees only
-- active notices on approved+visible campuses; the owner (submitted_by) and
-- admin/super_admin see and manage everything for their campus.
DROP POLICY IF EXISTS "Public reads active campus notices" ON public.campus_notices;
CREATE POLICY "Public reads active campus notices" ON public.campus_notices
  FOR SELECT USING (
    (is_active = true AND EXISTS (
      SELECT 1 FROM public.campus_onboard_requests c
      WHERE c.id = campus_notices.campus_id AND c.status = 'approved' AND c.is_visible = true
    ))
    OR auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_notices.campus_id AND c.submitted_by = auth.uid())
    ))
  );

DROP POLICY IF EXISTS "Owners and admins manage campus notices" ON public.campus_notices;
CREATE POLICY "Owners and admins manage campus notices" ON public.campus_notices
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_notices.campus_id AND c.submitted_by = auth.uid())
    ))
  ) WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_notices.campus_id AND c.submitted_by = auth.uid())
    ))
  );

-- Notify the campus owner when an admin posts a notice for their campus (the
-- reverse -- owner posts, admin gets notified -- isn't needed: admins already
-- see everything on the admin page), same pattern as db/47's other triggers.
CREATE OR REPLACE FUNCTION public.notify_campus_notice_posted()
RETURNS trigger AS $$
DECLARE
  v_owner uuid;
  v_campus_name text;
BEGIN
  SELECT submitted_by, campus_name INTO v_owner, v_campus_name
  FROM public.campus_onboard_requests WHERE id = NEW.campus_id;

  IF v_owner IS NOT NULL AND v_owner <> NEW.posted_by THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (v_owner, 'campus_notice_posted', '📌 New Notice Posted',
            'A notice "' || NEW.title || '" was posted for ' || v_campus_name || '.',
            '/dashboard/campus');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_campus_notice_posted ON public.campus_notices;
CREATE TRIGGER trg_notify_campus_notice_posted
  AFTER INSERT ON public.campus_notices
  FOR EACH ROW EXECUTE FUNCTION public.notify_campus_notice_posted();
