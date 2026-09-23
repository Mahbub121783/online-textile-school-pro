-- Self-hosted Postgres has no pg_cron, so qb_leaderboard_cache was never
-- refreshed after the initial migration-time SELECT qb_refresh_leaderboard()
-- call. Instead of relying on an external cron job, refresh it instantly
-- whenever an exam session is actually submitted.
CREATE OR REPLACE FUNCTION public.trg_qb_refresh_leaderboard_on_submit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.submitted_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.submitted_at IS NULL) THEN
    PERFORM public.qb_refresh_leaderboard();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qb_exam_sessions_refresh_leaderboard ON public.qb_exam_sessions;
CREATE TRIGGER qb_exam_sessions_refresh_leaderboard
AFTER INSERT OR UPDATE OF submitted_at ON public.qb_exam_sessions
FOR EACH ROW EXECUTE FUNCTION public.trg_qb_refresh_leaderboard_on_submit();

SELECT public.qb_refresh_leaderboard();
