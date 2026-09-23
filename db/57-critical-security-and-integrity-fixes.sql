-- Fixes for a full-system audit (auth/RLS, payments/wallet, student
-- dashboard, and a fresh review of today's Fabric Library work). Each
-- section is independently a live, verified bug -- see the accompanying
-- backend/frontend commit for the matching code-side fixes.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- =====================================================================
-- 1. CRITICAL: enrollments had no column-level restriction on UPDATE --
-- any student could PATCH their own enrollment row's course_id to ANY
-- course via the generic REST endpoint and instantly grant themselves
-- free access, with no order/payment ever involved. RLS's WITH CHECK
-- can't compare OLD vs NEW values on its own (no per-column USING), so
-- this needs a trigger, not a policy tweak.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.prevent_enrollment_tamper()
RETURNS trigger AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    IF NEW.course_id IS DISTINCT FROM OLD.course_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.payment_id IS DISTINCT FROM OLD.payment_id THEN
      RAISE EXCEPTION 'Cannot change course_id/user_id/payment_id on an enrollment' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_enrollment_tamper ON public.enrollments;
CREATE TRIGGER trg_prevent_enrollment_tamper BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_enrollment_tamper();

-- =====================================================================
-- 2. CRITICAL: a withdrawal_request row could be inserted with a NEGATIVE
-- amount (the INSERT policy only checked balance >= amount, which is
-- trivially true for any negative amount). debit_wallet() then computed
-- `balance - (negative amount)`, i.e. ADDED money -- an admin approving
-- such a request mints unlimited wallet balance for the requester.
-- Fix both the policy (can't insert a non-positive amount at all) and
-- the functions themselves (defense in depth -- these are also called
-- from other flows like checkout/referral/revenue-share credit).
-- =====================================================================
DROP POLICY IF EXISTS "Users request own withdrawal" ON public.wallet_transactions;
CREATE POLICY "Users request own withdrawal" ON public.wallet_transactions
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND type = 'withdrawal_request'
      AND wallet_transactions.amount > 0
      AND EXISTS (
        SELECT 1 FROM public.wallets w
        WHERE w.id = wallet_transactions.wallet_id
          AND w.user_id = auth.uid()
          AND w.balance >= wallet_transactions.amount
      )
    )
  );

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
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'credit_wallet amount must be positive' USING ERRCODE = '22003';
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
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'debit_wallet amount must be positive' USING ERRCODE = '22003';
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
-- 3. order_items.price had no floor -- defense in depth alongside the
-- backend's own new `realPrice < 0` rejection in computeRealOrderTotal().
-- =====================================================================
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_price_non_negative;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_price_non_negative CHECK (price >= 0);

-- =====================================================================
-- 4. CRITICAL (today's own regression): 3 UPDATE policies added in
-- db/56-fabric-library.sql had no WITH CHECK, defaulting to the USING
-- clause -- i.e. authorizing the ENTIRE row, not just the intended
-- field(s). campus_gallery_images (which this migration's header said it
-- "mirrors") deliberately has no UPDATE policy at all for exactly this
-- reason; these three do need one (receipt confirmation, catalog edits,
-- library summary/status), so pin every other column to its old value
-- instead of removing the grant.
-- =====================================================================
DROP POLICY IF EXISTS "Owners and admins confirm fabric distribution receipt" ON public.campus_fabric_hanger_distributions;
CREATE POLICY "Owners and admins confirm fabric distribution receipt" ON public.campus_fabric_hanger_distributions
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_fabric_hanger_distributions.campus_id AND c.submitted_by = auth.uid())
    ))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR (
        EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_fabric_hanger_distributions.campus_id AND c.submitted_by = auth.uid())
        AND quantity = campus_fabric_hanger_distributions.quantity
        AND hanger_id = campus_fabric_hanger_distributions.hanger_id
        AND campus_id = campus_fabric_hanger_distributions.campus_id
        AND distributed_at = campus_fabric_hanger_distributions.distributed_at
      )
    ))
  );

DROP POLICY IF EXISTS "Admins update fabric hanger catalog" ON public.fabric_hangers;
CREATE POLICY "Admins update fabric hanger catalog" ON public.fabric_hangers
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
        AND current_stock = fabric_hangers.current_stock)
  );

DROP POLICY IF EXISTS "Owners and admins update campus fabric libraries" ON public.campus_fabric_libraries;
CREATE POLICY "Owners and admins update campus fabric libraries" ON public.campus_fabric_libraries
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_fabric_libraries.campus_id AND c.submitted_by = auth.uid())
    ))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR (
        EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_fabric_libraries.campus_id AND c.submitted_by = auth.uid())
        AND campus_id = campus_fabric_libraries.campus_id
        AND created_by IS NOT DISTINCT FROM campus_fabric_libraries.created_by
      )
    ))
  );

-- =====================================================================
-- 5. CRITICAL: site_settings was fully public-readable (`USING (true)`,
-- db/05) and holds the real SMTP account password (`smtp_pass`, read by
-- sendSmtpEmail.js) plus other operational secrets (e.g. indexnow_key) --
-- anyone could GET /rest/v1/site_settings?key=eq.smtp_pass and read it in
-- plaintext. useSettings.ts (src/hooks/useSettings.ts) genuinely does a
-- blanket `select('key,value')` from public pages platform-wide, so this
-- can't be fixed by changing the frontend query -- it must filter at the
-- RLS layer. A pattern-based exclusion (rather than a fixed key list)
-- also protects any future secret-shaped key an admin adds later.
-- =====================================================================
DROP POLICY IF EXISTS "Public read site settings" ON public.site_settings;
CREATE POLICY "Public read non-sensitive site settings" ON public.site_settings
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
    OR (
      key NOT ILIKE '%pass%' AND key NOT ILIKE '%secret%'
      AND key NOT ILIKE '%_key' AND key NOT ILIKE 'api_key%' AND key NOT ILIKE '%token%'
    )
  );

-- =====================================================================
-- 6. HIGH: student_id_cards let a student INSERT/UPDATE their own row
-- with ANY is_active/download_blocked/valid_until/card_number they liked
-- (the policy only checked ownership, not which values). The one
-- legitimate client-side computation of these fields
-- (src/lib/ensureStudentIdCard.ts, count * 6 months from the earliest
-- paid enrollment) is trustworthy input but an untrustworthy *enforcement
-- point* -- move the same math server-side so it's authoritative
-- regardless of what a client actually sends.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.enforce_student_id_card_integrity()
RETURNS trigger AS $$
DECLARE
  _privileged boolean;
  _count integer;
  _earliest timestamptz;
BEGIN
  _privileged := (current_setting('request.jwt.claim.role', true) = 'service_role')
    OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin');
  IF _privileged THEN
    RETURN NEW;
  END IF;

  SELECT count(*), min(enrolled_at) INTO _count, _earliest
  FROM public.enrollments WHERE user_id = NEW.user_id AND payment_id IS NOT NULL;

  IF _count IS NULL OR _count = 0 THEN
    RAISE EXCEPTION 'No paid enrollments -- cannot issue a student ID card' USING ERRCODE = '42501';
  END IF;

  NEW.valid_from := _earliest;
  NEW.valid_until := _earliest + (_count * interval '6 months');
  NEW.is_active := true;
  NEW.download_blocked := false;
  IF TG_OP = 'UPDATE' THEN
    NEW.card_number := OLD.card_number;
  ELSIF NEW.card_number IS NULL OR length(btrim(NEW.card_number)) = 0 THEN
    NEW.card_number := 'OTS-ID-' || lpad(floor(random() * 900000 + 100000)::text, 6, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_student_id_card_integrity ON public.student_id_cards;
CREATE TRIGGER trg_enforce_student_id_card_integrity BEFORE INSERT OR UPDATE ON public.student_id_cards
  FOR EACH ROW EXECUTE FUNCTION public.enforce_student_id_card_integrity();

-- =====================================================================
-- 7. MEDIUM: `coupon_usage` (singular) is referenced everywhere in
-- checkoutFinalize.js and useCouponValidation.ts, and existed in the
-- original pre-migration schema (src/integrations/supabase/types.ts) as
-- its own table distinct from `coupon_usages` (plural, also original,
-- different purpose) -- but only the plural table got reconstructed in
-- db/00. Every coupon with a per_user_limit has been 500ing checkout
-- (unhandled "relation does not exist"), and usage recording has been
-- silently failing since self-host.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.coupon_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id),
  order_id uuid REFERENCES public.orders(id),
  used_at timestamptz NOT NULL DEFAULT now()
);
-- One usage record per order (defensive -- finalizeOrder is already
-- idempotent on order.status, this just makes the invariant explicit).
CREATE UNIQUE INDEX IF NOT EXISTS coupon_usage_unique_order ON public.coupon_usage (coupon_id, order_id) WHERE order_id IS NOT NULL;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and admins read coupon usage" ON public.coupon_usage;
CREATE POLICY "Users and admins read coupon usage" ON public.coupon_usage
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );
DROP POLICY IF EXISTS "Service role writes coupon usage" ON public.coupon_usage;
CREATE POLICY "Service role writes coupon usage" ON public.coupon_usage
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- =====================================================================
-- 8. CRITICAL (functional): `lessons` had exactly one policy in the whole
-- schema -- instructors/admin manage -- and NO student-facing SELECT
-- policy at all. Combined with FORCE ROW LEVEL SECURITY (db/04), every
-- enrolled student's curriculum/lesson list has been completely empty.
-- Preview lessons (is_preview=true) are visible to everyone on a
-- published course (matches CourseDetail.tsx's existing "Preview" UI);
-- full lesson access requires a real, matching enrollment row.
-- =====================================================================
DROP POLICY IF EXISTS "Enrolled students and preview viewers see lessons" ON public.lessons;
CREATE POLICY "Enrolled students and preview viewers see lessons" ON public.lessons
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (
      is_preview = true
      AND EXISTS (
        SELECT 1 FROM public.course_sections cs
        JOIN public.courses c ON c.id = cs.course_id
        WHERE cs.id = lessons.section_id AND c.is_published = true
      )
    )
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR EXISTS (
        SELECT 1 FROM public.course_sections cs
        JOIN public.enrollments e ON e.course_id = cs.course_id
        WHERE cs.id = lessons.section_id AND e.user_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM public.course_sections cs WHERE cs.id = lessons.section_id AND can_manage_course(cs.course_id))
    ))
  );

-- =====================================================================
-- 9. CRITICAL (functional): three more `.upsert(...,{onConflict})`/
-- `ON CONFLICT` call sites targeting columns with no matching real UNIQUE
-- constraint -- the exact same bug class already fixed 3 times before in
-- this codebase (enrollments db/33, ebook_reading_progress db/30,
-- media_library db/52). certificates(user_id,course_id) breaks
-- issueCertificate.js's ON CONFLICT for every course-completion cert;
-- lesson_progress(user_id,lesson_id) breaks "Mark Complete" and video
-- autosave for every lesson; reviews(user_id,course_id) breaks every
-- course-review submission/edit.
-- =====================================================================
CREATE UNIQUE INDEX IF NOT EXISTS certificates_user_course_unique_idx
  ON public.certificates (user_id, course_id) WHERE course_id IS NOT NULL;

ALTER TABLE public.lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_user_lesson_unique;
ALTER TABLE public.lesson_progress ADD CONSTRAINT lesson_progress_user_lesson_unique UNIQUE (user_id, lesson_id);

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_user_course_unique;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_course_unique UNIQUE (user_id, course_id);
