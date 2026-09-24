-- Adds a 'daily' bucket to the practice leaderboard, for the new homepage
-- hero-banner "Today's Top 3" / "This Week's Top 3" slides. The existing
-- all_time/monthly/weekly buckets already auto-refresh instantly on every
-- exam submission (db/69 trigger, fixed by db/73) and every 15 minutes via
-- cPanel cron as a safety net -- extending qb_refresh_leaderboard() to also
-- compute 'daily' automatically gets both of those for free, no trigger
-- changes needed.
--
-- "Daily" is a calendar day in Asia/Dhaka local time (this audience's own
-- day boundary), same reasoning as the Friday Flash Day refill in db/80.

-- Step 1: new enum value. Must be committed before it's referenced below,
-- so this runs as its own statement (psql autocommits each top-level
-- statement by default -- nothing here is wrapped in an explicit
-- BEGIN/COMMIT).
ALTER TYPE public.qb_leaderboard_period ADD VALUE IF NOT EXISTS 'daily';

SELECT set_config('request.jwt.claim.role', 'service_role', false);

CREATE OR REPLACE FUNCTION public.qb_refresh_leaderboard()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _dhaka_today_start timestamptz := (date_trunc('day', now() AT TIME ZONE 'Asia/Dhaka') AT TIME ZONE 'Asia/Dhaka');
BEGIN
  DELETE FROM public.qb_leaderboard_cache;

  -- All-time grand
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'all_time'::qb_leaderboard_period, NULL, NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(AVG(percentage)::NUMERIC, 2), SUM(score), RANK() OVER (ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL GROUP BY user_id;

  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'monthly', NULL, NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(AVG(percentage)::NUMERIC, 2), SUM(score), RANK() OVER (ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND submitted_at >= date_trunc('month', now()) GROUP BY user_id;

  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'weekly', NULL, NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(AVG(percentage)::NUMERIC, 2), SUM(score), RANK() OVER (ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND submitted_at >= date_trunc('week', now()) GROUP BY user_id;

  -- Daily grand (new) -- Asia/Dhaka calendar day
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'daily', NULL, NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(AVG(percentage)::NUMERIC, 2), SUM(score), RANK() OVER (ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND submitted_at >= _dhaka_today_start GROUP BY user_id;

  -- All-time, per subject
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'all_time', subject_id, NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(AVG(percentage)::NUMERIC, 2), SUM(score),
         RANK() OVER (PARTITION BY subject_id ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND subject_id IS NOT NULL GROUP BY user_id, subject_id;

  -- All-time, per difficulty
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'all_time', NULL, difficulty, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(AVG(percentage)::NUMERIC, 2), SUM(score),
         RANK() OVER (PARTITION BY difficulty ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL GROUP BY user_id, difficulty;

  -- All-time, per (subject, difficulty)
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'all_time', subject_id, difficulty, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(AVG(percentage)::NUMERIC, 2), SUM(score),
         RANK() OVER (PARTITION BY subject_id, difficulty ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND subject_id IS NOT NULL GROUP BY user_id, subject_id, difficulty;
END;
$function$;

-- Refresh now so the daily bucket is populated immediately rather than
-- waiting for the next submission or the 15-min cron tick.
SELECT public.qb_refresh_leaderboard();
