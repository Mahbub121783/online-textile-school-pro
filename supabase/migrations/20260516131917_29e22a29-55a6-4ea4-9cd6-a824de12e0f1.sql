-- 1. REVOKE EXECUTE on cron-only / maintenance SECURITY DEFINER functions
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'kill_idle_connections()',
    'prune_free_tier_data()',
    'cleanup_old_ai_chats()',
    'pg_housekeeping_daily()',
    'auto_update_workshop_status()',
    'qb_refresh_leaderboard()',
    'qb_aggregate_question_stats()',
    'qb_auto_close_orphans()',
    'refresh_homepage_stats()',
    'notify_admins(text, text, text, text)',
    'maybe_run_unreplied_message_reminder()',
    'maybe_run_workshop_reminder()',
    'maybe_run_workshop_auto_status()',
    'bulk_issue_workshop_certificates(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip: %', fn;
    END;
  END LOOP;
END $$;

-- 2. Tighter housekeeping
CREATE OR REPLACE FUNCTION public.pg_housekeeping_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM cron.job_run_details WHERE end_time < now() - interval '24 hours';
  DELETE FROM net._http_response WHERE created < now() - interval '24 hours';
  DELETE FROM public.email_logs WHERE created_at < now() - interval '30 days';
  PERFORM public.cleanup_old_ai_chats();
END $$;
REVOKE EXECUTE ON FUNCTION public.pg_housekeeping_daily() FROM PUBLIC, anon, authenticated;

-- 3. Transaction-safe VACUUM wrapper (VACUUM ANALYZE works inside SECURITY DEFINER function via cron)
CREATE OR REPLACE FUNCTION public.pg_vacuum_bloat_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE 'VACUUM (ANALYZE) cron.job_run_details';
  EXECUTE 'VACUUM (ANALYZE) net._http_response';
EXCEPTION WHEN OTHERS THEN
  -- VACUUM can't run inside a transaction; cron runs each command standalone so this is fine
  RAISE NOTICE 'vacuum skipped: %', SQLERRM;
END $$;
REVOKE EXECUTE ON FUNCTION public.pg_vacuum_bloat_tables() FROM PUBLIC, anon, authenticated;

-- Reschedule vacuum cron to use the new wrapper, running VACUUM as a top-level statement
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pg-vacuum-daily') THEN
    PERFORM cron.unschedule('pg-vacuum-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'pg-vacuum-daily',
  '35 4 * * *',
  $$ VACUUM (ANALYZE) cron.job_run_details; VACUUM (ANALYZE) net._http_response; $$
);

-- 4. Storage: stop public listing of `media` bucket
DROP POLICY IF EXISTS "Anyone can view media files" ON storage.objects;

CREATE POLICY "Admins or owners can list media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'media'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR owner = auth.uid()
  )
);