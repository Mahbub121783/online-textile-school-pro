-- Campus Onboarding, phase 4: real hero/cover banner (separate from the
-- small square logo -- the user specifically asked for a "cover photo" and
-- none existed) + guaranteed real-time notifications for every event in the
-- lifecycle (new request submitted, approved, rejected, a student links
-- themselves, a gallery photo gets added). Notifications fire via DB
-- triggers (SECURITY DEFINER, same pattern as
-- link_university_to_campus() in db/42) rather than only from the specific
-- backend endpoints, so they fire no matter which code path writes the row
-- (direct REST insert from the frontend, or a backend function) -- consistent
-- with how the rest of the app already treats "real-time" (instant DB write
-- + the existing 60s-polling NotificationBell, per useNotifications.ts).
SELECT set_config('request.jwt.claim.role', 'service_role', false);

ALTER TABLE public.campus_onboard_requests
  ADD COLUMN IF NOT EXISTS cover_image_url text;

-- 1) Notify every admin/super_admin the moment a new campus request comes
--    in. Previously admins only found out by opening the admin page (which
--    itself only polls every 20s) -- no push at all.
CREATE OR REPLACE FUNCTION public.notify_campus_admins_new_request()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT ur.user_id, 'campus_request_submitted', '🏫 New Campus Onboarding Request',
         NEW.campus_name || ' (' || NEW.area || ') has requested to join the campus network.',
         '/admin/campus-onboard'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'super_admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_campus_admins_new_request ON public.campus_onboard_requests;
CREATE TRIGGER trg_notify_campus_admins_new_request
  AFTER INSERT ON public.campus_onboard_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_campus_admins_new_request();

-- 2) Notify the campus owner the moment a student links themselves to their
--    campus -- either via the "I'm a student here" button or automatically
--    via the university-autolink trigger (db/42).
CREATE OR REPLACE FUNCTION public.notify_campus_student_linked()
RETURNS trigger AS $$
DECLARE
  v_owner uuid;
  v_campus_name text;
  v_student_name text;
BEGIN
  IF NEW.onboarded_campus_id IS NULL OR NEW.onboarded_campus_id IS NOT DISTINCT FROM OLD.onboarded_campus_id THEN
    RETURN NEW;
  END IF;

  SELECT submitted_by, campus_name INTO v_owner, v_campus_name
  FROM public.campus_onboard_requests WHERE id = NEW.onboarded_campus_id;

  IF v_owner IS NOT NULL AND v_owner <> NEW.id THEN
    -- COALESCE alone doesn't catch full_name being '' (common for
    -- freshly-registered profiles) rather than NULL -- confirmed live: a
    -- test notification rendered as " just registered under..." with the
    -- name silently blank.
    v_student_name := COALESCE(NULLIF(trim(NEW.full_name), ''), 'A student');
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (v_owner, 'campus_student_linked', '👋 New Student Registered',
            v_student_name || ' just registered under ' || v_campus_name || ' on Online Textile School.',
            '/dashboard/campus');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_campus_student_linked ON public.user_profiles;
CREATE TRIGGER trg_notify_campus_student_linked
  AFTER UPDATE OF onboarded_campus_id ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_campus_student_linked();

-- 3) Notify the campus owner when a linked student (not the owner
--    themselves) adds a gallery photo, so they know to review it.
CREATE OR REPLACE FUNCTION public.notify_campus_gallery_upload()
RETURNS trigger AS $$
DECLARE
  v_owner uuid;
  v_campus_name text;
BEGIN
  SELECT submitted_by, campus_name INTO v_owner, v_campus_name
  FROM public.campus_onboard_requests WHERE id = NEW.campus_id;

  IF v_owner IS NOT NULL AND v_owner <> NEW.uploaded_by THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (v_owner, 'campus_gallery_upload', '📸 New Gallery Photo',
            'A student added a new photo to the ' || v_campus_name || ' gallery.',
            '/dashboard/campus');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_campus_gallery_upload ON public.campus_gallery_images;
CREATE TRIGGER trg_notify_campus_gallery_upload
  AFTER INSERT ON public.campus_gallery_images
  FOR EACH ROW EXECUTE FUNCTION public.notify_campus_gallery_upload();
