-- 1. Track reminder send time
ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_workshops_reminder_window
  ON public.workshops (start_at)
  WHERE reminder_sent_at IS NULL;

-- 2. Schedule cron every 5 minutes (unschedule first if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'workshop-reminder-cron') THEN
    PERFORM cron.unschedule('workshop-reminder-cron');
  END IF;
END $$;

SELECT cron.schedule(
  'workshop-reminder-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kaiiyssrwkapromkfidv.supabase.co/functions/v1/workshop-reminder-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthaWl5c3Nyd2thcHJvbWtmaWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTgxNTMsImV4cCI6MjA4OTk5NDE1M30.kmJucyS-7nFY4gAiTB9Xy7gEEfgszCETicfEjkhuERM'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);