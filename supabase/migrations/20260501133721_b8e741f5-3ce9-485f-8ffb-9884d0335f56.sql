DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'workshop-reminder-cron') THEN
    PERFORM cron.unschedule('workshop-reminder-cron');
  END IF;
END $$;

SELECT cron.schedule(
  'workshop-reminder-cron',
  '*/10 * * * *',
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