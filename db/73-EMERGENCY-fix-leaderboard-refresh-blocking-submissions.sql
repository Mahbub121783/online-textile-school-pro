-- EMERGENCY FIX: the auto-refresh trigger added in db/69 calls
-- qb_refresh_leaderboard(), which DELETEs+INSERTs into
-- qb_leaderboard_cache. That table has FORCE ROW LEVEL SECURITY but only
-- ever had a single SELECT policy -- zero INSERT/UPDATE/DELETE policies
-- exist. The trigger fires inside the SAME transaction as a student's
-- exam submission (a plain UPDATE on qb_exam_sessions via the generic
-- REST endpoint), so when the cache write gets rejected by RLS, the
-- whole transaction rolls back -- meaning the exam submission itself
-- fails with "new row violates row-level security policy for table
-- qb_leaderboard_cache". This went undetected in db/69 because at the
-- time there was zero exam-session data, so the refresh's INSERT ...
-- SELECT matched zero rows and RLS was never actually evaluated.

-- 1. Give the leaderboard cache real write policies, service-role only
--    (same pattern as "Service role writes/updates exam sessions").
DROP POLICY IF EXISTS qb_lb_service_write ON public.qb_leaderboard_cache;
CREATE POLICY qb_lb_service_write ON public.qb_leaderboard_cache
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS qb_lb_service_update ON public.qb_leaderboard_cache;
CREATE POLICY qb_lb_service_update ON public.qb_leaderboard_cache
  FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS qb_lb_service_delete ON public.qb_leaderboard_cache;
CREATE POLICY qb_lb_service_delete ON public.qb_leaderboard_cache
  FOR DELETE USING (auth.role() = 'service_role');

-- 2. Make the trigger elevate to service_role for its own duration,
--    transaction-locally (set_config's 3rd arg `true`), so it works
--    regardless of which role actually submitted the exam. Each REST
--    request runs in its own connection+transaction (backend/src/db.js
--    withRequestContext: BEGIN ... COMMIT per request), so this can
--    never leak into another request.
CREATE OR REPLACE FUNCTION public.trg_qb_refresh_leaderboard_on_submit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.submitted_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.submitted_at IS NULL) THEN
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    PERFORM public.qb_refresh_leaderboard();
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Refresh now (with real data this time) to populate the cache with
--    whatever exam sessions have already been submitted while this bug
--    was live.
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT public.qb_refresh_leaderboard();
