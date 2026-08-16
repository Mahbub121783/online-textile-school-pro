-- Push real-time updates for the new campus features (notices, gallery,
-- instructor/student roster, profile edits) to anyone viewing that campus's
-- public portfolio page -- these pages are anonymous/public, so this reuses
-- the same 'ots_realtime' channel realtime.js already LISTENs on, just
-- keyed by campus_id instead of user_id (realtime.js's notification handler
-- already branches on which key is present in the payload).
SELECT set_config('request.jwt.claim.role', 'service_role', false);

CREATE OR REPLACE FUNCTION public.notify_campus_notices_changed()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ots_realtime', json_build_object(
    'campus_id', COALESCE(NEW.campus_id, OLD.campus_id), 'event', 'notices_changed'
  )::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_campus_notices_changed ON public.campus_notices;
CREATE TRIGGER trg_notify_campus_notices_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.campus_notices
  FOR EACH ROW EXECUTE FUNCTION public.notify_campus_notices_changed();

CREATE OR REPLACE FUNCTION public.notify_campus_gallery_changed()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ots_realtime', json_build_object(
    'campus_id', COALESCE(NEW.campus_id, OLD.campus_id), 'event', 'gallery_changed'
  )::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_campus_gallery_changed ON public.campus_gallery_images;
CREATE TRIGGER trg_notify_campus_gallery_changed
  AFTER INSERT OR DELETE ON public.campus_gallery_images
  FOR EACH ROW EXECUTE FUNCTION public.notify_campus_gallery_changed();

-- Instructor/student roster changes -- fires when someone links or unlinks
-- themselves via onboarded_campus_id (covers both the old and new campus
-- if it changed, e.g. someone switching campuses).
CREATE OR REPLACE FUNCTION public.notify_campus_people_changed()
RETURNS trigger AS $$
BEGIN
  IF NEW.onboarded_campus_id IS NOT NULL AND NEW.onboarded_campus_id IS DISTINCT FROM OLD.onboarded_campus_id THEN
    PERFORM pg_notify('ots_realtime', json_build_object('campus_id', NEW.onboarded_campus_id, 'event', 'people_changed')::text);
  END IF;
  IF OLD.onboarded_campus_id IS NOT NULL AND OLD.onboarded_campus_id IS DISTINCT FROM NEW.onboarded_campus_id THEN
    PERFORM pg_notify('ots_realtime', json_build_object('campus_id', OLD.onboarded_campus_id, 'event', 'people_changed')::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_campus_people_changed ON public.user_profiles;
CREATE TRIGGER trg_notify_campus_people_changed
  AFTER UPDATE OF onboarded_campus_id ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_campus_people_changed();

-- Profile edits (leadership, highlights, description, logo/cover, etc.) --
-- so a visitor already on the portfolio page sees an owner/admin edit land
-- without needing to reload.
CREATE OR REPLACE FUNCTION public.notify_campus_profile_changed()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ots_realtime', json_build_object('campus_id', NEW.id, 'event', 'profile_changed')::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_campus_profile_changed ON public.campus_onboard_requests;
CREATE TRIGGER trg_notify_campus_profile_changed
  AFTER UPDATE ON public.campus_onboard_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_campus_profile_changed();
