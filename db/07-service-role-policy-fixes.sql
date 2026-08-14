-- ============================================================
-- Service-role RLS gaps found while live-testing the ported edge functions
-- (send-smtp-email, password-reset-request/verify, process-payment,
-- r2-presign, ebook-secure-access). These functions run backend-trusted
-- queries via serviceQuery() (see backend/src/db.js), which sets
-- auth.role() = 'service_role' -- equivalent to what the original Supabase
-- edge functions did with the SERVICE_ROLE_KEY (full RLS bypass). Since we
-- have no real BYPASSRLS role, every table they touch needs an explicit
-- auth.role() = 'service_role' policy, scoped to only what each function
-- actually does (least privilege, not a blanket ALL grant).
--
-- password_reset_codes had ZERO policies (RLS enabled + FORCE = deny-all),
-- same "pre-history" gap class as the 34 tables in 05-bootstrap-policies.sql
-- -- this table was apparently missed there. The others already had partial
-- policies (e.g. "Admins manage X") but nothing covering the service_role
-- backend path.
-- ============================================================

CREATE POLICY "Service role manages password reset codes" ON public.password_reset_codes
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- process-payment: read pending order by payment_reference, mark completed.
CREATE POLICY "Service role reads orders" ON public.orders
  FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Service role updates orders" ON public.orders
  FOR UPDATE USING (auth.role() = 'service_role');

-- process-payment: mark invoice paid after gateway verification.
CREATE POLICY "Service role updates invoices" ON public.invoices
  FOR UPDATE USING (auth.role() = 'service_role');

-- process-payment: create enrollment after a paid course order.
CREATE POLICY "Service role creates enrollments" ON public.enrollments
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- r2-presign: select/round-robin/status-update on R2 accounts, outside any
-- admin-authenticated request (upload flow runs as the uploading student).
CREATE POLICY "Service role reads R2 accounts" ON public.cloudflare_r2_accounts
  FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Service role updates R2 accounts" ON public.cloudflare_r2_accounts
  FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "Service role reads RR state" ON public.r2_round_robin_state
  FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Service role updates RR state" ON public.r2_round_robin_state
  FOR UPDATE USING (auth.role() = 'service_role');

-- process-payment: read active gateway credentials to call UddoktaPay.
CREATE POLICY "Service role reads payment gateways" ON public.payment_gateways
  FOR SELECT USING (auth.role() = 'service_role');

-- ebook-secure-access: verify a streaming token (INSERT/UPDATE already had
-- service_role policies; SELECT for the stream-verification read was missing).
CREATE POLICY "Service role reads ebook access tokens" ON public.ebook_access_tokens
  FOR SELECT USING (auth.role() = 'service_role');

-- ebook-secure-access + process-payment both join order_items to verify a
-- purchase / grant post-payment items. Only "Users read own" (authenticated)
-- and "Service role creates" (INSERT) existed -- no service_role SELECT.
CREATE POLICY "Service role reads order items" ON public.order_items
  FOR SELECT USING (auth.role() = 'service_role');

-- ebooks had NO public-read policy at all (unlike courses' "Public read
-- published courses") -- only "Instructors manage own ebooks". This broke
-- both the public ebook catalog for anonymous/regular visitors AND
-- ebook-secure-access's service_role lookup of the purchased ebook's file.
-- Mirrors the courses policy shape exactly.
CREATE POLICY "Public read published ebooks" ON public.ebooks
  FOR SELECT USING (
    is_published = true
    OR auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (created_by = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  );
