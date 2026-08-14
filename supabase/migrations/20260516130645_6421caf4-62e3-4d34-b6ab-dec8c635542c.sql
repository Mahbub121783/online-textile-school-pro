-- pg_cron unavailable on self-host; old job unschedule calls removed.
-- Helper: invoke unreplied-message-reminder edge function only if unread messages exist
CREATE OR REPLACE FUNCTION public.maybe_run_unreplied_message_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.chat_messages
    WHERE is_read = false
      AND deleted_at IS NULL
      AND created_at < now() - interval '30 minutes'
      AND created_at > now() - interval '24 hours'
    LIMIT 1
  ) THEN
    PERFORM net.http_post(
      url := 'https://kaiiyssrwkapromkfidv.supabase.co/functions/v1/unreplied-message-reminder',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthaWl5c3Nyd2thcHJvbWtmaWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTgxNTMsImV4cCI6MjA4OTk5NDE1M30.kmJucyS-7nFY4gAiTB9Xy7gEEfgszCETicfEjkhuERM"}'::jsonb,
      body := concat('{"time": "', now(), '"}')::jsonb
    );
  END IF;
END $$;

-- Helper: invoke workshop-reminder-cron only if upcoming workshops with registrations exist
CREATE OR REPLACE FUNCTION public.maybe_run_workshop_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.workshops w
    WHERE w.status IN ('published','ongoing')
      AND w.start_at IS NOT NULL
      AND w.start_at BETWEEN now() - interval '30 minutes' AND now() + interval '24 hours'
      AND EXISTS (
        SELECT 1 FROM public.workshop_registrations r
        WHERE r.workshop_id = w.id AND r.status = 'registered'
      )
    LIMIT 1
  ) THEN
    PERFORM net.http_post(
      url := 'https://kaiiyssrwkapromkfidv.supabase.co/functions/v1/workshop-reminder-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthaWl5c3Nyd2thcHJvbWtmaWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTgxNTMsImV4cCI6MjA4OTk5NDE1M30.kmJucyS-7nFY4gAiTB9Xy7gEEfgszCETicfEjkhuERM'
      ),
      body := '{}'::jsonb
    );
  END IF;
END $$;

-- Helper: only run workshop status flip if any workshop is actually due to transition
CREATE OR REPLACE FUNCTION public.maybe_run_workshop_auto_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.workshops
    WHERE (status = 'published' AND start_at IS NOT NULL AND start_at <= now())
       OR (status = 'ongoing'   AND COALESCE(end_at, start_at + interval '4 hours') + interval '30 minutes' <= now())
    LIMIT 1
  ) THEN
    PERFORM public.auto_update_workshop_status();
  END IF;
END $$;

-- pg_cron unavailable on self-host; scheduling moved to cPanel Cron Jobs (Phase 5).
-- Original: 'unreplied-message-reminder' & 'workshop-reminder-cron' */15 * * * *, 'workshop-auto-status' */30 * * * *
-- Phase 5 note: these net.http_post calls inside the functions above also need porting to call
-- the new Node backend instead of the dead *.supabase.co edge function URLs.

-- Instant event-driven trigger: when a new registration is created, hit the reminder fn right away
CREATE OR REPLACE FUNCTION public.tg_workshop_registration_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://kaiiyssrwkapromkfidv.supabase.co/functions/v1/workshop-reminder-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthaWl5c3Nyd2thcHJvbWtmaWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTgxNTMsImV4cCI6MjA4OTk5NDE1M30.kmJucyS-7nFY4gAiTB9Xy7gEEfgszCETicfEjkhuERM'
      ),
      body := jsonb_build_object('workshop_id', NEW.workshop_id, 'trigger', 'new_registration')
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never fail the registration insert
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS workshop_registration_notify_trg ON public.workshop_registrations;
CREATE TRIGGER workshop_registration_notify_trg
AFTER INSERT ON public.workshop_registrations
FOR EACH ROW
WHEN (NEW.status = 'registered')
EXECUTE FUNCTION public.tg_workshop_registration_notify();