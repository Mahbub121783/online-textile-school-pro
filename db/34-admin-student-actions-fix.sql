-- Admin "Students" detail page audit found FOUR more broken admin actions,
-- all the same root cause: RLS policies written as pure row-ownership
-- checks (auth.uid() = target row's user_id) with no admin/super_admin
-- escape hatch, so an admin acting ON BEHALF OF a student (whose uid is
-- never the admin's own auth.uid()) gets rejected by RLS every time.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- 1. Active/Blocked toggle: user_profiles UPDATE had no admin branch.
DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
CREATE POLICY "Users update own profile" ON public.user_profiles
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

-- 2. Grant Course: enrollments had no direct admin-grant INSERT branch
-- (only self-enroll-after-paid-checkout and service_role existed).
DROP POLICY IF EXISTS "Admins grant enrollments" ON public.enrollments;
CREATE POLICY "Admins grant enrollments" ON public.enrollments
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  );

-- 3. Grant Ebook: order_items INSERT only checked that the order belongs
-- to the caller -- an admin creating a $0 order+order_item on a
-- student's behalf (StudentDetail.tsx's grantEbook) always failed on the
-- second insert, after already leaving a real (orphaned) $0 order row
-- behind from the first insert.
DROP POLICY IF EXISTS "Admins create order items" ON public.order_items;
CREATE POLICY "Admins create order items" ON public.order_items
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  );

-- Clean up ghost $0 orders left behind by every failed "Grant Ebook"
-- attempt before this fix (completed status, zero total, zero items).
DELETE FROM public.orders o
WHERE o.payment_method = 'admin_grant'
  AND o.total = 0
  AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id);

-- 4. Manual ID card generation: student_id_cards was never created on
-- this self-hosted DB at all (only exists in the dead, unreplayed
-- supabase/migrations/20260402181941_*.sql) -- every read/write against
-- it has been erroring "relation does not exist" since the self-host
-- cutover. Recreated verbatim (plus the later download_blocked column
-- addition) with GUC-based RLS matching the original intent.
CREATE TABLE IF NOT EXISTS public.student_id_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  card_number text NOT NULL UNIQUE,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  download_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.student_id_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_id_cards FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students view own id card" ON public.student_id_cards;
CREATE POLICY "Students view own id card" ON public.student_id_cards
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

DROP POLICY IF EXISTS "Students insert own id card" ON public.student_id_cards;
CREATE POLICY "Students insert own id card" ON public.student_id_cards
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

DROP POLICY IF EXISTS "Students update own id card" ON public.student_id_cards;
CREATE POLICY "Students update own id card" ON public.student_id_cards
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

DROP POLICY IF EXISTS "Admins delete id cards" ON public.student_id_cards;
CREATE POLICY "Admins delete id cards" ON public.student_id_cards
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );
