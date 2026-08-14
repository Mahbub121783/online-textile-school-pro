-- pg_cron/pg_net unavailable on self-host; scheduling moved to cPanel Cron Jobs (Phase 5).
-- Original jobs removed here: unreplied-message-reminder, workshop-auto-status, qb-auto-close-orphans,
-- pg-housekeeping-daily, pg-vacuum-daily, kill-idle-connections (all superseded/rescheduled below or in later migrations).

CREATE OR REPLACE FUNCTION public.pg_housekeeping_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('cron.job_run_details') IS NOT NULL THEN
    EXECUTE $sql$
      DELETE FROM cron.job_run_details
      WHERE end_time < now() - interval '2 days'
    $sql$;
  END IF;

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

-- pg_cron unavailable on self-host; scheduling moved to cPanel Cron Jobs (Phase 5).
-- Original: pg-housekeeping-daily (0 4 * * *), pg-vacuum-daily (30 4 * * *), kill-idle-connections (*/5 * * * *)

-- anon/authenticated/authenticator roles don't exist on self-host (only one
-- connecting role, tecnedub_ots_app); apply the same tuning to it instead.
-- NOTE: temp_buffers = '4MB' deliberately skipped -- a later migration
-- (20260516135050) shows this exact setting caused a production outage on
-- the original Supabase project (Postgres re-parses it as '4mb' on next
-- session and then rejects it), so it's omitted here entirely.
ALTER ROLE tecnedub_ots_app SET work_mem = '2MB';
ALTER ROLE tecnedub_ots_app SET idle_in_transaction_session_timeout = '120s';

SELECT public.pg_housekeeping_daily();
SELECT public.kill_idle_connections();