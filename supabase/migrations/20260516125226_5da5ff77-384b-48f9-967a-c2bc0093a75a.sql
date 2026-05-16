DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'unreplied-message-reminder') THEN
    PERFORM cron.unschedule('unreplied-message-reminder');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'workshop-auto-status') THEN
    PERFORM cron.unschedule('workshop-auto-status');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'qb-auto-close-orphans') THEN
    PERFORM cron.unschedule('qb-auto-close-orphans');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pg-housekeeping-daily') THEN
    PERFORM cron.unschedule('pg-housekeeping-daily');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pg-vacuum-daily') THEN
    PERFORM cron.unschedule('pg-vacuum-daily');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kill-idle-connections') THEN
    PERFORM cron.unschedule('kill-idle-connections');
  END IF;
END $$;

SELECT cron.schedule(
  'unreplied-message-reminder',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kaiiyssrwkapromkfidv.supabase.co/functions/v1/unreplied-message-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthaWl5c3Nyd2thcHJvbWtmaWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTgxNTMsImV4cCI6MjA4OTk5NDE1M30.kmJucyS-7nFY4gAiTB9Xy7gEEfgszCETicfEjkhuERM"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'workshop-auto-status',
  '*/10 * * * *',
  $$ SELECT public.auto_update_workshop_status(); $$
);

SELECT cron.schedule(
  'qb-auto-close-orphans',
  '*/30 * * * *',
  $$ SELECT public.qb_auto_close_orphans(); $$
);

CREATE OR REPLACE FUNCTION public.pg_housekeeping_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM cron.job_run_details
  WHERE end_time < now() - interval '2 days';

  IF to_regclass('net._http_response') IS NOT NULL THEN
    EXECUTE $sql$
      DELETE FROM net._http_response
      WHERE created < now() - interval '1 day'
    $sql$;
  END IF;

  DELETE FROM public.email_logs
  WHERE created_at < now() - interval '30 days';

  DELETE FROM public.ai_chat_history
  WHERE created_at < now() - interval '14 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.kill_idle_connections()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _terminated integer := 0;
BEGIN
  WITH stale AS (
    SELECT pid
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid()
      AND (
        (
          state IN ('idle in transaction', 'idle in transaction (aborted)')
          AND state_change < now() - interval '2 minutes'
        )
        OR
        (
          state = 'idle'
          AND state_change < now() - interval '10 minutes'
          AND COALESCE(application_name, '') NOT LIKE 'realtime%'
          AND COALESCE(application_name, '') NOT LIKE 'pg_cron%'
          AND COALESCE(application_name, '') <> 'postgres_exporter'
        )
      )
  ), terminated AS (
    SELECT pg_terminate_backend(pid) AS did_terminate
    FROM stale
  )
  SELECT count(*) FILTER (WHERE did_terminate)
    INTO _terminated
  FROM terminated;

  RETURN COALESCE(_terminated, 0);
END;
$$;

SELECT cron.schedule(
  'pg-housekeeping-daily',
  '0 4 * * *',
  $$ SELECT public.pg_housekeeping_daily(); $$
);

SELECT cron.schedule(
  'pg-vacuum-daily',
  '30 4 * * *',
  $$ VACUUM (ANALYZE) cron.job_run_details, net._http_response, public.email_logs, public.ai_chat_history; $$
);

SELECT cron.schedule(
  'kill-idle-connections',
  '*/5 * * * *',
  $$ SELECT public.kill_idle_connections(); $$
);

ALTER ROLE anon SET work_mem = '2MB';
ALTER ROLE authenticated SET work_mem = '2MB';
ALTER ROLE authenticator SET work_mem = '2MB';

ALTER ROLE anon SET temp_buffers = '4MB';
ALTER ROLE authenticated SET temp_buffers = '4MB';
ALTER ROLE authenticator SET temp_buffers = '4MB';

ALTER ROLE anon SET idle_in_transaction_session_timeout = '120s';
ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '120s';
ALTER ROLE authenticator SET idle_in_transaction_session_timeout = '120s';

SELECT public.pg_housekeeping_daily();
SELECT public.kill_idle_connections();