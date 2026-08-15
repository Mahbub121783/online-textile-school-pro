-- CRITICAL SECURITY + FUNCTIONAL FIXES, found via a live deep-audit of the
-- payment/checkout/wallet/coupon/withdraw/ebook/instructor-registration
-- surface. Several of these are actively exploitable financial bugs on the
-- live site (unrestricted wallet mint/drain, self-approving orders, a full
-- DRM bypass leaking paid ebook files to anonymous users) -- this migration
-- closes all of them in one pass. See accompanying backend/frontend changes
-- (checkout finalize endpoint, rest.js RPC_BLOCKLIST, Checkout.tsx rewrite)
-- which several of these fixes depend on to keep legitimate flows working.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- =====================================================================
-- 1. credit_wallet / debit_wallet: CRITICAL. These SECURITY DEFINER
-- functions self-elevate to service_role internally and previously had
-- NO check on who the *original* (pre-elevation) caller was. Since real
-- browser JWTs issued by this backend NEVER carry role='service_role'
-- (signToken() hardcodes role:'authenticated' -- see backend/src/auth.js),
-- any real request through the public /rest/v1/rpc/:fn endpoint arrives
-- with role='authenticated' (or 'anon'). Requiring the pre-elevation role
-- to already be 'service_role' means these functions can now ONLY ever
-- succeed when called from backend-internal serviceQuery() (which sets
-- that GUC directly, never over HTTP) -- never from a client RPC call,
-- no matter what _user_id/_amount is passed. This was previously wide
-- open: anyone could POST /rpc/credit_wallet {_user_id: self, _amount:
-- 999999} and mint unlimited balance, or drain any known user's wallet
-- via debit_wallet. All legitimate client-triggered wallet operations
-- (checkout payment, referral reward, instructor revenue, admin
-- withdrawal approval) must now go through a backend endpoint that uses
-- serviceQuery() -- see backend/src/functions/checkoutFinalize.js.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.credit_wallet(_user_id uuid, _amount numeric, _description text, _reference_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _wallet_id uuid;
  _prev_role text;
BEGIN
  _prev_role := current_setting('request.jwt.claim.role', true);
  IF _prev_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'credit_wallet may only be called by trusted backend code' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  SELECT id INTO _wallet_id FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, 0) RETURNING id INTO _wallet_id;
  END IF;

  UPDATE public.wallets SET balance = balance + _amount, updated_at = now() WHERE id = _wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, amount, type, description, reference_id)
  VALUES (_wallet_id, _amount, 'credit', _description, _reference_id);

  PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.debit_wallet(_user_id uuid, _amount numeric, _description text, _reference_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _wallet_id uuid;
  _balance numeric;
  _prev_role text;
BEGIN
  _prev_role := current_setting('request.jwt.claim.role', true);
  IF _prev_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'debit_wallet may only be called by trusted backend code' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  SELECT id, balance INTO _wallet_id, _balance FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet_id IS NULL OR _balance < _amount THEN
    PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
    RETURN false;
  END IF;

  UPDATE public.wallets SET balance = balance - _amount, updated_at = now() WHERE id = _wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, amount, type, description, reference_id)
  VALUES (_wallet_id, _amount, 'debit', _description, _reference_id);

  PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
  RETURN true;
END;
$function$;

-- =====================================================================
-- 2. orders: CRITICAL. The previous UPDATE policy let an authenticated
-- owner set status/total to literally anything on their own row,
-- including 'completed' -- which the enrollments INSERT policy trusts
-- to grant course access. A student could PATCH their own pending order
-- to status='completed' directly via the generic REST endpoint and get
-- free access to any paid course, no payment ever made. Owners may now
-- only self-transition to 'cancelled'; only admin/super_admin/service_role
-- (i.e. the new backend finalize endpoint) may mark an order 'completed'.
-- =====================================================================
DROP POLICY IF EXISTS "Users update own orders" ON public.orders;
CREATE POLICY "Users update own orders" ON public.orders
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      user_id = auth.uid()
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'super_admin')
    ))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
    OR (auth.role() = 'authenticated' AND user_id = auth.uid() AND status = 'cancelled')
  );

-- =====================================================================
-- 3. order_items: the cart's 'practice_credits' item type never matched
-- this CHECK constraint (only 'course'/'ebook'/'tokens' were allowed),
-- so any checkout containing a practice-credit top-up hard-failed at the
-- very first insert. Widen it to match what the frontend actually sends.
-- =====================================================================
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_item_type_check;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_item_type_check
  CHECK (item_type = ANY (ARRAY['course'::text, 'ebook'::text, 'tokens'::text, 'practice_credits'::text]));

-- =====================================================================
-- 4. wallet_transactions: withdrawal requests. There was no owner-INSERT
-- branch at all (service_role only), so the "Submit Withdrawal Request"
-- button on both the student and instructor wallet pages has been
-- hard-failing since the self-host cutover -- the admin withdrawal queue
-- has been permanently empty. Allow an authenticated user to create a
-- 'withdrawal_request' row for their OWN wallet, and only when the
-- requested amount does not exceed their current balance (closes the
-- "can insert any amount" gap noted in the audit -- debit_wallet() also
-- re-checks the balance at approval time, so this is defense in depth,
-- not the only guard).
-- =====================================================================
DROP POLICY IF EXISTS "Users request own withdrawal" ON public.wallet_transactions;
CREATE POLICY "Users request own withdrawal" ON public.wallet_transactions
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND type = 'withdrawal_request'
      AND EXISTS (
        SELECT 1 FROM public.wallets w
        WHERE w.id = wallet_transactions.wallet_id
          AND w.user_id = auth.uid()
          AND w.balance >= wallet_transactions.amount
      )
    )
  );

-- =====================================================================
-- 5. instructor_applications: `status` is NOT NULL with no default, and
-- the frontend's insert never sets it -- every "Become Instructor"
-- submission has been hard-failing with a NOT NULL violation. `reviewed_at`
-- also defaulted to now() at row-creation time, meaning it would look
-- pre-"reviewed" before an admin ever looked at it.
-- =====================================================================
ALTER TABLE public.instructor_applications ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.instructor_applications ALTER COLUMN reviewed_at DROP DEFAULT;
UPDATE public.instructor_applications SET reviewed_at = NULL WHERE reviewed_by IS NULL AND status = 'pending';

-- =====================================================================
-- 6. ebook_access_tokens: admin manual-order-approval (AdminOrders.tsx)
-- inserts a token directly as the admin's own session to grant ebook
-- access on manually-verified payments -- there was no admin INSERT
-- branch (service_role only), so this silently failed (no error surfaced
-- because the frontend never checks .error on that specific call).
-- =====================================================================
DROP POLICY IF EXISTS "Admins grant ebook access tokens" ON public.ebook_access_tokens;
CREATE POLICY "Admins grant ebook access tokens" ON public.ebook_access_tokens
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

-- =====================================================================
-- 7. increment_coupon_usage: coupons.used_count could never be
-- incremented by a real purchase (UPDATE requires admin role), so the
-- global usage_limit check in useCouponValidation.ts was permanently
-- unenforceable. This narrowly-scoped RPC lets a user bump the counter
-- only for a coupon they can prove they just recorded a real usage row
-- for (coupon_usage, the correctly-RLS'd singular table -- NOT the
-- service-role-only plural coupon_usages the frontend was also trying
-- and failing to write to).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(_coupon_id uuid, _order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _prev_role text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.coupon_usage cu
    WHERE cu.coupon_id = _coupon_id AND cu.user_id = auth.uid() AND cu.order_id = _order_id
  ) THEN
    RAISE EXCEPTION 'No matching coupon usage record for this user/order' USING ERRCODE = '42501';
  END IF;

  _prev_role := current_setting('request.jwt.claim.role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.coupons SET used_count = COALESCE(used_count, 0) + 1 WHERE id = _coupon_id;
  PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
END;
$function$;

-- =====================================================================
-- 8. payment_gateways_public: CRITICAL. payment_gateways.credentials
-- holds real secrets for some gateway types (API keys for uddoktapay/
-- sslcommerz) alongside display-safe info for others (bKash/Nagad/Rocket
-- send-money numbers, bank account details). RLS is row-level only, so
-- there is no way to safely expose "the row" to authenticated users
-- while hiding one column's sensitive contents for some gateway types --
-- opening SELECT on the base table to authenticated users (which is what
-- the live checkout page actually needs) would let anyone directly query
-- `?select=credentials` and read API secrets. Instead: a genuinely
-- separate table holding ONLY the pre-whitelisted safe fields per
-- gateway type, kept in sync via trigger, that authenticated users (and
-- anonymous ones, since checkout needs to render before login in some
-- flows) may freely read for active gateways. This also fixes the
-- previously-live bug where the whole payment method UI was invisible
-- to every real customer (payment_gateways had no authenticated SELECT
-- policy at all, so activeGateways was always empty).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.payment_gateways_public (
  id uuid PRIMARY KEY,
  gateway_name text NOT NULL,
  display_name text,
  is_active boolean NOT NULL DEFAULT false,
  public_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_gateways_public ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_gateways_public FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads active gateway public info" ON public.payment_gateways_public;
CREATE POLICY "Anyone reads active gateway public info" ON public.payment_gateways_public
  FOR SELECT
  USING (
    is_active = true
    OR auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );
DROP POLICY IF EXISTS "Service role writes gateway public info" ON public.payment_gateways_public;
CREATE POLICY "Service role writes gateway public info" ON public.payment_gateways_public
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.safe_gateway_public_info(_gateway_name text, _credentials jsonb)
 RETURNS jsonb LANGUAGE sql IMMUTABLE AS $function$
  SELECT CASE _gateway_name
    WHEN 'bank' THEN jsonb_build_object(
      'bank_name', _credentials->>'bank_name', 'account_name', _credentials->>'account_name',
      'account_number', _credentials->>'account_number', 'branch', _credentials->>'branch',
      'routing_number', _credentials->>'routing_number')
    WHEN 'bkash' THEN jsonb_build_object('phone_number', _credentials->>'phone_number', 'account_type', _credentials->>'account_type')
    WHEN 'nagad' THEN jsonb_build_object('phone_number', _credentials->>'phone_number', 'account_type', _credentials->>'account_type')
    WHEN 'rocket' THEN jsonb_build_object('phone_number', _credentials->>'phone_number', 'account_type', _credentials->>'account_type')
    ELSE '{}'::jsonb
  END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_sync_payment_gateway_public()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _prev_role text;
BEGIN
  _prev_role := current_setting('request.jwt.claim.role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.payment_gateways_public WHERE id = OLD.id;
    PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
    RETURN OLD;
  END IF;
  INSERT INTO public.payment_gateways_public (id, gateway_name, display_name, is_active, public_info, updated_at)
  VALUES (NEW.id, NEW.gateway_name, NEW.display_name, NEW.is_active, public.safe_gateway_public_info(NEW.gateway_name, NEW.credentials), now())
  ON CONFLICT (id) DO UPDATE SET
    gateway_name = EXCLUDED.gateway_name, display_name = EXCLUDED.display_name,
    is_active = EXCLUDED.is_active, public_info = EXCLUDED.public_info, updated_at = now();
  PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_payment_gateway_public ON public.payment_gateways;
CREATE TRIGGER trg_sync_payment_gateway_public
AFTER INSERT OR UPDATE OR DELETE ON public.payment_gateways
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_payment_gateway_public();

INSERT INTO public.payment_gateways_public (id, gateway_name, display_name, is_active, public_info, updated_at)
SELECT id, gateway_name, display_name, is_active, public.safe_gateway_public_info(gateway_name, credentials), now()
FROM public.payment_gateways
ON CONFLICT (id) DO UPDATE SET
  gateway_name = EXCLUDED.gateway_name, display_name = EXCLUDED.display_name,
  is_active = EXCLUDED.is_active, public_info = EXCLUDED.public_info, updated_at = now();

-- =====================================================================
-- 9. ebook_secure_files: CRITICAL DRM bypass fix. "Public read published
-- ebooks" has an unconditional `is_published = true` branch (correct,
-- needed for the catalog to work for anonymous visitors) -- but RLS is
-- row-level, not column-level, so that same branch also let anyone
-- directly request `?select=file_url` on the generic REST endpoint and
-- get the raw storage URL for any published (including paid) ebook's
-- file, completely bypassing the token-gated ebook-secure-access
-- streaming proxy, the purchase check, and the watermark/DRM. Move the
-- real file_url out of the publicly-selectable `ebooks` row entirely: a
-- BEFORE trigger intercepts any insert/update carrying a file_url, moves
-- it into this separate service/owner-only table, and nulls it out of
-- the row that's actually stored -- so `ebooks.file_url` is now always
-- empty from that point forward, no matter how it's queried.
-- backend/src/functions/ebookSecureAccess.js is updated to read from
-- this table instead.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ebook_secure_files (
  ebook_id uuid PRIMARY KEY REFERENCES public.ebooks(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ebook_secure_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebook_secure_files FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role and owners access secure ebook files" ON public.ebook_secure_files;
CREATE POLICY "Service role and owners access secure ebook files" ON public.ebook_secure_files
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM public.ebooks e WHERE e.id = ebook_secure_files.ebook_id
        AND (e.created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
    ))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM public.ebooks e WHERE e.id = ebook_secure_files.ebook_id
        AND (e.created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
    ))
  );

INSERT INTO public.ebook_secure_files (ebook_id, file_url)
SELECT id, file_url FROM public.ebooks WHERE file_url IS NOT NULL AND file_url <> ''
ON CONFLICT (ebook_id) DO UPDATE SET file_url = EXCLUDED.file_url, updated_at = now();

CREATE OR REPLACE FUNCTION public.tg_ebooks_extract_file_url()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _prev_role text;
BEGIN
  IF NEW.file_url IS NOT NULL AND NEW.file_url <> '' THEN
    _prev_role := current_setting('request.jwt.claim.role', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    INSERT INTO public.ebook_secure_files (ebook_id, file_url, updated_at)
    VALUES (NEW.id, NEW.file_url, now())
    ON CONFLICT (ebook_id) DO UPDATE SET file_url = EXCLUDED.file_url, updated_at = now();
    -- Must run AFTER the ebooks row itself is committed (see db/43) --
    -- a BEFORE trigger's NEW.id doesn't exist in ebooks yet, so the FK
    -- above would fail. Null out file_url via a follow-up UPDATE instead
    -- of mutating NEW; the IF guard above stops it from recursing.
    UPDATE public.ebooks SET file_url = NULL WHERE id = NEW.id AND file_url IS NOT NULL;
    PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ebooks_extract_file_url ON public.ebooks;
CREATE TRIGGER trg_ebooks_extract_file_url
AFTER INSERT OR UPDATE ON public.ebooks
FOR EACH ROW EXECUTE FUNCTION public.tg_ebooks_extract_file_url();

-- Backfilled rows above already have file_url copied out -- null it from
-- the base table now so existing rows stop leaking immediately too.
UPDATE public.ebooks SET file_url = NULL WHERE file_url IS NOT NULL AND file_url <> '';

-- =====================================================================
-- 10. Approval-before-visibility for courses: `courses` already had
-- review_status/rejection_reason columns and a working admin
-- approve/reject UI (CoursesListTab.tsx), but nothing stopped an
-- instructor from calling handleSave('approved') themselves (the
-- "Publish Now" button sets is_published=true directly) -- the review
-- workflow existed but was entirely optional/bypassable. Lock it down
-- at the RLS layer: only admin/super_admin/service_role may ever write
-- is_published=true or review_status='approved'; an instructor's own
-- writes are only accepted while the row stays unpublished/draft/pending.
-- =====================================================================
DROP POLICY IF EXISTS "Instructors and admins manage courses" ON public.courses;
CREATE POLICY "Instructors and admins manage courses" ON public.courses
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (instructor_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
    OR (
      auth.role() = 'authenticated' AND instructor_id = auth.uid()
      AND is_published = false
      AND (review_status IS NULL OR review_status IN ('draft', 'pending'))
    )
  );

-- =====================================================================
-- 11. Same approval gate for ebooks, mirroring courses. ebooks had no
-- review_status/rejection_reason columns at all -- add them, and lock
-- down writes the same way (instructor can create/edit freely but can
-- never set is_published=true themselves; only admin/super_admin can).
-- =====================================================================
ALTER TABLE public.ebooks ADD COLUMN IF NOT EXISTS review_status text;
ALTER TABLE public.ebooks ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.ebooks ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.ebooks ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
UPDATE public.ebooks SET review_status = CASE WHEN is_published THEN 'approved' ELSE 'draft' END WHERE review_status IS NULL;

DROP POLICY IF EXISTS "Instructors manage own ebooks" ON public.ebooks;
CREATE POLICY "Instructors manage own ebooks" ON public.ebooks
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
    OR (
      auth.role() = 'authenticated' AND created_by = auth.uid()
      AND is_published = false
      AND (review_status IS NULL OR review_status IN ('draft', 'pending'))
    )
  );
