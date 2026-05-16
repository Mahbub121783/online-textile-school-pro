
DO $$
BEGIN
  PERFORM cron.unschedule(jobname)
    FROM cron.job
   WHERE jobname IN ('qb-refresh-leaderboard','qb-prune-free-tier','qb-aggregate-question-stats','qb-auto-close-orphans');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('qb-refresh-leaderboard', '*/15 * * * *', $$SELECT public.qb_refresh_leaderboard();$$);
SELECT cron.schedule('qb-prune-free-tier', '0 21 * * *', $$SELECT public.prune_free_tier_data();$$);
SELECT cron.schedule('qb-aggregate-question-stats', '30 21 * * *', $$SELECT public.qb_aggregate_question_stats();$$);
SELECT cron.schedule('qb-auto-close-orphans', '*/10 * * * *', $$SELECT public.qb_auto_close_orphans();$$);
