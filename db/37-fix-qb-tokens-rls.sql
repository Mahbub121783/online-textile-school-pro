-- CRITICAL, platform-wide: qb_user_tokens had ONLY a SELECT policy (see
-- db/05-bootstrap-policies.sql's best-effort reconstruction). Every real
-- token operation is a SECURITY DEFINER SQL function (qb_get_token_status,
-- qb_consume_tokens) that INSERTs/UPDATEs this table under the CALLER's own
-- request.jwt.claim.role='authenticated' GUC (SECURITY DEFINER changes the
-- Postgres execution role for grants, but NOT the GUC-based auth.uid()/
-- auth.role() our RLS policies read) -- so literally every student's first
-- qb_get_token_status() call (which lazily creates their token row / does
-- the daily refill) and every qb_consume_tokens() call (spending tokens to
-- start an exam) has been hard-failing with "new row violates row-level
-- security policy for table qb_user_tokens" since day one of self-hosting.
-- This is the root cause of "practice token shows not available even though
-- she took zero exams that day" -- the balance check itself was throwing,
-- and the frontend's error fallback reads as "no tokens".
DROP POLICY IF EXISTS "users insert own tokens" ON public.qb_user_tokens;
CREATE POLICY "users insert own tokens" ON public.qb_user_tokens
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "users update own tokens" ON public.qb_user_tokens;
CREATE POLICY "users update own tokens" ON public.qb_user_tokens
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND user_id = auth.uid())
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND user_id = auth.uid())
  );

-- qb_token_ledger: same gap -- only a SELECT policy existed, but
-- qb_consume_tokens() (and the paid top-up grant, qb_credit_paid_tokens_admin)
-- both INSERT a ledger row under the caller's/admin's own GUC context.
DROP POLICY IF EXISTS "users insert own ledger" ON public.qb_token_ledger;
CREATE POLICY "users insert own ledger" ON public.qb_token_ledger
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND user_id = auth.uid())
  );
