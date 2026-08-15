-- Real-time push infrastructure: fires pg_notify('ots_realtime', ...) on the
-- events users actually complained about being slow to reflect --
-- role grants/revokes, profile edits, and new notifications. The Node
-- backend's realtime.js LISTENs on this channel and pushes to the affected
-- user's open SSE connection(s) instantly, instead of them waiting for
-- useAuth.tsx's 30s poll or useNotifications.ts's 60s poll. Those polls stay
-- in place as a fallback (SSE connections can drop), this just makes the
-- common case near-instant instead of "up to 30-60s".
SELECT set_config('request.jwt.claim.role', 'service_role', false);

CREATE OR REPLACE FUNCTION public.notify_realtime_user_roles_changed()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid := COALESCE(NEW.user_id, OLD.user_id);
BEGIN
  PERFORM pg_notify('ots_realtime', json_build_object('user_id', v_user_id, 'event', 'roles_changed')::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_realtime_user_roles_changed ON public.user_roles;
CREATE TRIGGER trg_notify_realtime_user_roles_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.notify_realtime_user_roles_changed();

CREATE OR REPLACE FUNCTION public.notify_realtime_profile_changed()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ots_realtime', json_build_object('user_id', NEW.id, 'event', 'profile_changed')::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_realtime_profile_changed ON public.user_profiles;
CREATE TRIGGER trg_notify_realtime_profile_changed
  AFTER UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_realtime_profile_changed();

CREATE OR REPLACE FUNCTION public.notify_realtime_new_notification()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ots_realtime', json_build_object('user_id', NEW.user_id, 'event', 'notification')::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_realtime_new_notification ON public.notifications;
CREATE TRIGGER trg_notify_realtime_new_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_realtime_new_notification();
