-- Replaces db/87's hard "need >= 3 exams to be ranked" cutoff with the same
-- Bayesian-average formula real-world "top" leaderboards use for exactly
-- this fairness problem (IMDb's Top 250 rating formula, also used by
-- BoardGameGeek and Steam review scores):
--
--   weighted_score = (v / (v + m)) * R  +  (m / (v + m)) * C
--
--   R = this user's own accuracy this period = SUM(score)/SUM(total_points)*100
--   v = number of exams they've submitted this period (their "vote count")
--   C = the average accuracy of everyone else in this exact bucket
--       (this period / subject / difficulty combination) -- the "prior"
--   m = 3, a tuning constant: how many exams' worth of confidence a user
--       needs before their own score dominates their prior
--
-- Why this instead of a hard cutoff: db/87's "< 3 exams = pushed to the
-- bottom, no matter what" was a cliff -- a user's 2nd and 3rd exam behaved
-- totally differently depending on which side of the line they landed on.
-- The Bayesian blend is smooth: a 1-exam 100% scorer is pulled most of the
-- way toward the bucket's average (can't jump straight to #1 off one lucky
-- exam), but as they take more exams (v grows), the (v/(v+m)) weight on
-- their own real accuracy grows too, until at v >> m their rank is
-- effectively their true accuracy -- no artificial threshold anywhere.
--
-- total_points (raw summed score, shown as "pts") and avg_percentage
-- (this user's own true accuracy, SUM(score)/SUM(total_points)*100) are
-- UNCHANGED and still show the real numbers -- only the invisible `rank`
-- column is computed with the Bayesian blend now.
--
-- ALSO FIXES A SEPARATE, BIGGER BUG found while auditing "is Today's count
-- real": qb_auto_close_orphans() (the every-10-min job that force-closes
-- exam sessions abandoned mid-exam -- no heartbeat for 15+ min) marks them
-- status = 'completed', identical to a real voluntary submission via
-- qb_submit_exam. Every count that read `submitted_at IS NOT NULL` (this
-- leaderboard, admin analytics) could not tell "a student really finished
-- this exam" apart from "a student walked away weeks ago and a robot
-- closed it today." Live evidence: of today's 76 session rows, 52 share
-- one identical timestamp (05:30:02) and score 0 -- one batch of
-- auto-closed orphans (some started back on 2026-08-14) dumped into
-- "today"'s numbers the moment the sweep ran, not real today activity.
-- Fix: give auto-closed orphans their own status ('expired', reusing the
-- value qb_start_exam already uses for the "superseded by a new attempt"
-- case) and require status = 'completed' everywhere real exam counts are
-- computed. status is a plain text column (no enum), so no migration
-- needed for the new value itself.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- Auto-close orphans from now on as 'expired', not 'completed'.
CREATE OR REPLACE FUNCTION public.qb_auto_close_orphans()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _closed INT := 0;
BEGIN
  WITH dead AS (
    SELECT id FROM public.qb_exam_sessions
    WHERE submitted_at IS NULL
      AND (
        (last_heartbeat_at IS NOT NULL AND last_heartbeat_at < now() - interval '15 minutes')
        OR (last_heartbeat_at IS NULL AND started_at < now() - interval '1 hour')
      )
  ),
  upd AS (
    UPDATE public.qb_exam_sessions s
       SET submitted_at = now(),
           status = 'expired',
           passed = false,
           percentage = COALESCE(
             (SELECT ROUND((COUNT(*) FILTER (WHERE a.is_correct)::numeric / NULLIF(s.total_questions,0)) * 100, 2)
              FROM public.qb_exam_answers a WHERE a.session_id = s.id), 0),
           time_taken_seconds = EXTRACT(EPOCH FROM (now() - s.started_at))::int
     WHERE s.id IN (SELECT id FROM dead)
     RETURNING 1
  )
  SELECT COUNT(*) INTO _closed FROM upd;
  RETURN _closed;
END;
$function$;

-- Backfill: the one already-mislabeled batch identified above. Matched by
-- its exact shared timestamp (unique to this one sweep -- confirmed via
-- live audit that no other row shares it), not by score, so a genuine
-- submission that happened to score 0 is never touched.
UPDATE public.qb_exam_sessions
  SET status = 'expired'
  WHERE submitted_at = '2026-09-25 05:30:02.17863-06'::timestamptz AND status = 'completed';

CREATE OR REPLACE FUNCTION public.qb_refresh_leaderboard()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _dhaka_today_start timestamptz := (date_trunc('day', now() AT TIME ZONE 'Asia/Dhaka') AT TIME ZONE 'Asia/Dhaka');
  _prior_strength CONSTANT numeric := 3;
BEGIN
  DELETE FROM public.qb_leaderboard_cache;

  -- All-time grand
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  WITH agg AS (
    SELECT user_id, COUNT(*) AS v, COUNT(*) FILTER (WHERE passed) AS passed_ct,
           ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2) AS r, SUM(score) AS pts
    FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND status = 'completed' GROUP BY user_id
  ), scored AS (
    SELECT *, AVG(r) OVER () AS c FROM agg
  )
  SELECT user_id, 'all_time'::qb_leaderboard_period, NULL, NULL, v, passed_ct, COALESCE(r, 0), pts,
         RANK() OVER (ORDER BY (v / (v + _prior_strength)) * COALESCE(r, 0) + (_prior_strength / (v + _prior_strength)) * COALESCE(c, 0) DESC, pts DESC)
  FROM scored;

  -- Monthly
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  WITH agg AS (
    SELECT user_id, COUNT(*) AS v, COUNT(*) FILTER (WHERE passed) AS passed_ct,
           ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2) AS r, SUM(score) AS pts
    FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND status = 'completed' AND submitted_at >= date_trunc('month', now()) GROUP BY user_id
  ), scored AS (
    SELECT *, AVG(r) OVER () AS c FROM agg
  )
  SELECT user_id, 'monthly', NULL, NULL, v, passed_ct, COALESCE(r, 0), pts,
         RANK() OVER (ORDER BY (v / (v + _prior_strength)) * COALESCE(r, 0) + (_prior_strength / (v + _prior_strength)) * COALESCE(c, 0) DESC, pts DESC)
  FROM scored;

  -- Weekly
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  WITH agg AS (
    SELECT user_id, COUNT(*) AS v, COUNT(*) FILTER (WHERE passed) AS passed_ct,
           ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2) AS r, SUM(score) AS pts
    FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND status = 'completed' AND submitted_at >= date_trunc('week', now()) GROUP BY user_id
  ), scored AS (
    SELECT *, AVG(r) OVER () AS c FROM agg
  )
  SELECT user_id, 'weekly', NULL, NULL, v, passed_ct, COALESCE(r, 0), pts,
         RANK() OVER (ORDER BY (v / (v + _prior_strength)) * COALESCE(r, 0) + (_prior_strength / (v + _prior_strength)) * COALESCE(c, 0) DESC, pts DESC)
  FROM scored;

  -- Daily -- Asia/Dhaka calendar day
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  WITH agg AS (
    SELECT user_id, COUNT(*) AS v, COUNT(*) FILTER (WHERE passed) AS passed_ct,
           ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2) AS r, SUM(score) AS pts
    FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND status = 'completed' AND submitted_at >= _dhaka_today_start GROUP BY user_id
  ), scored AS (
    SELECT *, AVG(r) OVER () AS c FROM agg
  )
  SELECT user_id, 'daily', NULL, NULL, v, passed_ct, COALESCE(r, 0), pts,
         RANK() OVER (ORDER BY (v / (v + _prior_strength)) * COALESCE(r, 0) + (_prior_strength / (v + _prior_strength)) * COALESCE(c, 0) DESC, pts DESC)
  FROM scored;

  -- All-time, per subject
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  WITH agg AS (
    SELECT user_id, subject_id, COUNT(*) AS v, COUNT(*) FILTER (WHERE passed) AS passed_ct,
           ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2) AS r, SUM(score) AS pts
    FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND status = 'completed' AND subject_id IS NOT NULL GROUP BY user_id, subject_id
  ), scored AS (
    SELECT *, AVG(r) OVER (PARTITION BY subject_id) AS c FROM agg
  )
  SELECT user_id, 'all_time', subject_id, NULL, v, passed_ct, COALESCE(r, 0), pts,
         RANK() OVER (PARTITION BY subject_id ORDER BY (v / (v + _prior_strength)) * COALESCE(r, 0) + (_prior_strength / (v + _prior_strength)) * COALESCE(c, 0) DESC, pts DESC)
  FROM scored;

  -- All-time, per difficulty
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  WITH agg AS (
    SELECT user_id, difficulty, COUNT(*) AS v, COUNT(*) FILTER (WHERE passed) AS passed_ct,
           ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2) AS r, SUM(score) AS pts
    FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND status = 'completed' GROUP BY user_id, difficulty
  ), scored AS (
    SELECT *, AVG(r) OVER (PARTITION BY difficulty) AS c FROM agg
  )
  SELECT user_id, 'all_time', NULL, difficulty, v, passed_ct, COALESCE(r, 0), pts,
         RANK() OVER (PARTITION BY difficulty ORDER BY (v / (v + _prior_strength)) * COALESCE(r, 0) + (_prior_strength / (v + _prior_strength)) * COALESCE(c, 0) DESC, pts DESC)
  FROM scored;

  -- All-time, per (subject, difficulty)
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  WITH agg AS (
    SELECT user_id, subject_id, difficulty, COUNT(*) AS v, COUNT(*) FILTER (WHERE passed) AS passed_ct,
           ROUND(SUM(score)::numeric / NULLIF(SUM(total_points), 0) * 100, 2) AS r, SUM(score) AS pts
    FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND status = 'completed' AND subject_id IS NOT NULL GROUP BY user_id, subject_id, difficulty
  ), scored AS (
    SELECT *, AVG(r) OVER (PARTITION BY subject_id, difficulty) AS c FROM agg
  )
  SELECT user_id, 'all_time', subject_id, difficulty, v, passed_ct, COALESCE(r, 0), pts,
         RANK() OVER (PARTITION BY subject_id, difficulty ORDER BY (v / (v + _prior_strength)) * COALESCE(r, 0) + (_prior_strength / (v + _prior_strength)) * COALESCE(c, 0) DESC, pts DESC)
  FROM scored;
END;
$function$;

SELECT public.qb_refresh_leaderboard();

SELECT set_config('request.jwt.claim.sub', 'f49d6153-1835-4455-81f3-2918d5d3484e', false);
\echo '--- orphan backfill: rows reclassified to expired (should be 52) ---'
SELECT count(*) FROM public.qb_exam_sessions WHERE submitted_at = '2026-09-25 05:30:02.17863-06'::timestamptz AND status = 'expired';
\echo '--- daily bucket after fix: should now show ~24 real submissions, not 76 ---'
SELECT count(*) AS ranked_users, sum(total_exams) AS total_exams
FROM public.qb_leaderboard_cache WHERE period = 'daily' AND subject_id IS NULL AND difficulty IS NULL;
\echo '--- all_time grand, Bayesian-weighted rank (real avg_percentage/total_points shown, rank uses the blend) ---'
SELECT user_id, total_exams, avg_percentage, total_points, rank
FROM public.qb_leaderboard_cache WHERE period = 'all_time' AND subject_id IS NULL AND difficulty IS NULL ORDER BY rank
LIMIT 15;
