-- SEVERE BUG: the practice-exam leaderboard alternates between showing only
-- the most recent submitter and going completely blank.
--
-- Root cause: qb_exam_sessions' only SELECT policy is
--   qb_sessions_own_read USING (auth.uid() = user_id OR qb_is_staff(auth.uid()))
-- qb_refresh_leaderboard() (SECURITY DEFINER) aggregates ALL users' sessions
-- via `SELECT user_id, ... FROM qb_exam_sessions WHERE submitted_at IS NOT
-- NULL GROUP BY user_id` -- but SECURITY DEFINER only elevates *privilege*
-- checks, not RLS policy predicates, which still evaluate against the
-- calling session's auth.uid()/auth.role() GUCs. db/73 gave service_role
-- write access to qb_leaderboard_cache (the destination) but never gave it
-- read access to qb_exam_sessions (the source) -- that half of the bug was
-- invisible at the time because db/83 confirmed 0 real exam sessions existed
-- yet to read.
--
-- Depending on which of the two refresh paths fires last, the effect
-- differs:
--   - The AFTER UPDATE trigger on a student's own submission (db/69) elevates
--     role to service_role but never touches the sub claim, so auth.uid()
--     is still that student's own id -- the refresh's SELECT only sees THAT
--     ONE student's row (matches "goes live right after an exam").
--   - The 15-min cron safety net (db/81, via backend/src/functions/
--     internalCron.js -> serviceQuery) sets sub to an empty string, matching
--     no user and no staff row -- the refresh's SELECT sees ZERO rows,
--     wiping qb_leaderboard_cache empty on its very next tick (matches
--     "blank after some time").
--
-- Fix: add a service_role bypass SELECT policy on qb_exam_sessions,
-- matching the exact pattern already used for its own INSERT/UPDATE
-- policies ("Service role writes/updates exam sessions"). This is a second,
-- independent PERMISSIVE policy -- Postgres OR's it with the existing
-- qb_sessions_own_read policy, so per-user/staff read behavior for normal
-- requests is completely unchanged.
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', 'f49d6153-1835-4455-81f3-2918d5d3484e', false);

DROP POLICY IF EXISTS qb_sessions_service_read ON public.qb_exam_sessions;
CREATE POLICY qb_sessions_service_read ON public.qb_exam_sessions
  FOR SELECT USING (auth.role() = 'service_role');

-- Refresh now with the fix in place, using the actual service-role path
-- (empty sub, exactly like the cron/trigger do) to prove it's fixed rather
-- than relying on this session's own staff-uid workaround.
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public.qb_refresh_leaderboard();

\echo '--- grand all_time bucket after fix (should be > 0) ---'
SELECT count(*) FROM public.qb_leaderboard_cache WHERE period = 'all_time' AND subject_id IS NULL AND difficulty IS NULL;
\echo '--- all buckets after fix ---'
SELECT period, subject_id, difficulty, count(*) AS ranked_users, sum(total_exams) AS total_exams
FROM public.qb_leaderboard_cache GROUP BY period, subject_id, difficulty ORDER BY period;
