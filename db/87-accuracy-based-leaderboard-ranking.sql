-- Ranking fairness fix, per user report: raw point-sum ranking let a
-- student who took MANY exams but answered mostly wrong outrank a student
-- who took FEWER exams but answered almost everything correctly, purely
-- because summed points favored volume over accuracy.
--
-- New rule (user-specified formula): rank by accuracy = total correct
-- points earned / total points possible across every submitted exam in the
-- period, e.g. "20 exams, 500 total possible marks, 250 earned -> 50%".
-- avg_percentage now stores exactly that weighted percentage (previously
-- it was a naive average of each exam's own percentage, unused for
-- ranking); total_points (raw summed score, shown as "pts") is unchanged
-- and kept purely as a supporting stat, it no longer drives rank.
--
-- Small-sample safeguard: pure percentage ranking lets one lucky exam
-- (1 exam, 100%) leapfrog a student with 50 exams at 95% -- the same
-- small-sample problem a 1-review 5-star product has against a
-- 10,000-review 4.8-star one. Fix: a user needs >= _min_qualifying_exams
-- (3) submitted exams in the period to be ranked among the "qualified"
-- group by accuracy; everyone else is still shown and still ranked among
-- themselves by the same accuracy formula, but always placed after every
-- qualified user, so a single exam can never buy the top spot.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

CREATE OR REPLACE FUNCTION public.qb_refresh_leaderboard()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _dhaka_today_start timestamptz := (date_trunc('day', now() AT TIME ZONE 'Asia/Dhaka') AT TIME ZONE 'Asia/Dhaka');
  _min_qualifying_exams CONSTANT int := 3;
BEGIN
  DELETE FROM public.qb_leaderboard_cache;

  -- All-time grand
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'all_time'::qb_leaderboard_period, NULL, NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2), SUM(score),
         RANK() OVER (ORDER BY (COUNT(*) >= _min_qualifying_exams) DESC,
                                ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2) DESC NULLS LAST,
                                SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL GROUP BY user_id;

  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'monthly', NULL, NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2), SUM(score),
         RANK() OVER (ORDER BY (COUNT(*) >= _min_qualifying_exams) DESC,
                                ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2) DESC NULLS LAST,
                                SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND submitted_at >= date_trunc('month', now()) GROUP BY user_id;

  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'weekly', NULL, NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2), SUM(score),
         RANK() OVER (ORDER BY (COUNT(*) >= _min_qualifying_exams) DESC,
                                ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2) DESC NULLS LAST,
                                SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND submitted_at >= date_trunc('week', now()) GROUP BY user_id;

  -- Daily grand -- Asia/Dhaka calendar day
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'daily', NULL, NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2), SUM(score),
         RANK() OVER (ORDER BY (COUNT(*) >= _min_qualifying_exams) DESC,
                                ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2) DESC NULLS LAST,
                                SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND submitted_at >= _dhaka_today_start GROUP BY user_id;

  -- All-time, per subject
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'all_time', subject_id, NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2), SUM(score),
         RANK() OVER (PARTITION BY subject_id ORDER BY (COUNT(*) >= _min_qualifying_exams) DESC,
                                ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2) DESC NULLS LAST,
                                SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND subject_id IS NOT NULL GROUP BY user_id, subject_id;

  -- All-time, per difficulty
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'all_time', NULL, difficulty, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2), SUM(score),
         RANK() OVER (PARTITION BY difficulty ORDER BY (COUNT(*) >= _min_qualifying_exams) DESC,
                                ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2) DESC NULLS LAST,
                                SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL GROUP BY user_id, difficulty;

  -- All-time, per (subject, difficulty)
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'all_time', subject_id, difficulty, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2), SUM(score),
         RANK() OVER (PARTITION BY subject_id, difficulty ORDER BY (COUNT(*) >= _min_qualifying_exams) DESC,
                                ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2) DESC NULLS LAST,
                                SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND subject_id IS NOT NULL GROUP BY user_id, subject_id, difficulty;
END;
$function$;

SELECT public.qb_refresh_leaderboard();

SELECT set_config('request.jwt.claim.sub', 'f49d6153-1835-4455-81f3-2918d5d3484e', false);
\echo '--- all_time grand, ranked by accuracy (>=3-exam users first) ---'
SELECT user_id, total_exams, avg_percentage, total_points, rank
FROM public.qb_leaderboard_cache WHERE period = 'all_time' AND subject_id IS NULL AND difficulty IS NULL ORDER BY rank
LIMIT 15;
