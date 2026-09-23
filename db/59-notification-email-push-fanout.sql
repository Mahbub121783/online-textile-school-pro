-- ============================================================
-- Every INSERT into public.notifications (already the single choke point
-- ~20 call sites across the app funnel through -- order events, approvals,
-- new messages, certificates, etc.) now also fans out to email + mobile
-- push, not just the realtime SSE bell it already drove. This migration
-- only widens the pg_notify payload that db/49's trigger already sends;
-- the actual email/push sending happens in Node (backend/src/notify.js,
-- called from backend/src/realtime.js's existing LISTEN handler) so it can
-- reach the SMTP/web-push libraries. CREATE OR REPLACE keeps the existing
-- trigger binding on public.notifications intact -- no DROP/CREATE TRIGGER
-- needed, same function OID.
-- ============================================================
SELECT set_config('request.jwt.claim.role', 'service_role', false);

CREATE OR REPLACE FUNCTION public.notify_realtime_new_notification()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ots_realtime', json_build_object(
    'user_id', NEW.user_id,
    'event', 'notification',
    'notification_id', NEW.id,
    'type', NEW.type,
    'title', left(NEW.title, 200),
    'message', left(NEW.message, 1000),
    'link', NEW.link,
    'already_emailed', COALESCE((NEW.metadata->>'already_emailed')::boolean, false)
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
