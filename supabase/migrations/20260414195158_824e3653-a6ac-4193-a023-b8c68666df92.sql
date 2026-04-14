SELECT cron.schedule(
  'unreplied-message-reminder',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kaiiyssrwkapromkfidv.supabase.co/functions/v1/unreplied-message-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthaWl5c3Nyd2thcHJvbWtmaWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTgxNTMsImV4cCI6MjA4OTk5NDE1M30.kmJucyS-7nFY4gAiTB9Xy7gEEfgszCETicfEjkhuERM"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);