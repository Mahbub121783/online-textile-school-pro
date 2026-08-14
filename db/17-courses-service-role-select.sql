-- courses had no service_role SELECT branch at all (unlike most other
-- tables audited this session) -- discovered while verifying newly-created
-- draft courses via serviceQuery(), which silently returned zero rows.
-- More importantly, processPayment.js's serviceQuery() course lookup
-- (instructor_id/revenue_share_pct for payout crediting) relies on being
-- able to read a course by id regardless of its publish state.
DROP POLICY IF EXISTS "Service role reads all courses" ON public.courses;
CREATE POLICY "Service role reads all courses" ON public.courses
  FOR SELECT
  USING (auth.role() = 'service_role');
