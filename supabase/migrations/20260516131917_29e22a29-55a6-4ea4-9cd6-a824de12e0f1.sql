-- 1. REVOKE EXECUTE on cron-only / maintenance SECURITY DEFINER functions
-- anon/authenticated roles don't exist on self-host, so this can't run at
-- the Postgres level here. Equivalent protection is enforced at the app
-- layer instead: backend/src/rest.js's /rpc/:fn handler blocklists these
-- exact function names (kill_idle_connections, prune_free_tier_data,
-- cleanup_old_ai_chats, pg_housekeeping_daily, auto_update_workshop_status,
-- qb_refresh_leaderboard, qb_aggregate_question_stats, qb_auto_close_orphans,
-- refresh_homepage_stats, notify_admins, maybe_run_unreplied_message_reminder,
-- maybe_run_workshop_reminder, maybe_run_workshop_auto_status,
-- bulk_issue_workshop_certificates) so they can never be reached via public RPC.

-- 2. Tighter housekeeping
CREATE OR REPLACE FUNCTION public.pg_housekeeping_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('cron.job_run_details') IS NOT NULL THEN
    EXECUTE $sql$ DELETE FROM cron.job_run_details WHERE end_time < now() - interval '24 hours' $sql$;
  END IF;
  IF to_regclass('net._http_response') IS NOT NULL THEN
    EXECUTE $sql$ DELETE FROM net._http_response WHERE created < now() - interval '24 hours' $sql$;
  END IF;
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

-- pg_cron unavailable on self-host; scheduling moved to a cPanel Cron Job (Phase 5).
-- Original: 'pg-vacuum-daily' at 35 4 * * * -> public.pg_vacuum_bloat_tables()

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