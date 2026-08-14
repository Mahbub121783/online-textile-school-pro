-- CRITICAL, platform-wide, revenue-blocking bug found via live checkout
-- testing: `orders`, `order_items`, and `invoices` are three of the ~50
-- pre-history "bootstrap" tables whose RLS policies were best-effort
-- reconstructed from types.ts (no real migration SQL existed for them --
-- see db/05-bootstrap-policies.sql). Their INSERT/UPDATE policies were
-- reconstructed as service_role/admin-only, with NO branch letting a
-- regular logged-in student create or update their OWN order.
--
-- But Checkout.tsx (the real, live checkout page) does these inserts/
-- updates directly as the authenticated student, not through a backend
-- function:
--   supabase.from('orders').insert({ user_id: user.id, ... })      <- hard-fails, throws
--   supabase.from('order_items').insert(orderItems)                <- hard-fails, throws
--   supabase.from('orders').update({ status: 'completed' })...     <- would also fail
--   supabase.from('invoices').insert({ user_id: user.id, ... })    <- silently caught
-- Confirmed live: a student's own POST to /rest/v1/orders returns
-- "new row violates row-level security policy for table orders".
--
-- Net effect: EVERY checkout attempt on the live site -- free or paid --
-- has been failing at the very first step (creating the order row) since
-- the self-host cutover. This is very likely the single most severe bug
-- found in the whole migration: nobody could actually finish enrolling in
-- or purchasing anything.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- orders also had no authenticated-self SELECT policy at all (service_role
-- only) -- src/pages/dashboard/OrdersPage.tsx (the student's own order
-- history page) would show permanently empty for every student.
DROP POLICY IF EXISTS "Users read own orders" ON public.orders;
CREATE POLICY "Users read own orders" ON public.orders
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      user_id = auth.uid()
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'super_admin')
    ))
  );

DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
CREATE POLICY "Users create own orders" ON public.orders
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      user_id = auth.uid()
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'super_admin')
    ))
  );

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
    OR (auth.role() = 'authenticated' AND (
      user_id = auth.uid()
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'super_admin')
    ))
  );

DROP POLICY IF EXISTS "Users create own order items" ON public.order_items;
CREATE POLICY "Users create own order items" ON public.order_items
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users create own invoices" ON public.invoices;
CREATE POLICY "Users create own invoices" ON public.invoices
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      user_id = auth.uid()
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'super_admin')
    ))
  );

DROP POLICY IF EXISTS "Users update own invoices" ON public.invoices;
CREATE POLICY "Users update own invoices" ON public.invoices
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
    OR (auth.role() = 'authenticated' AND (
      user_id = auth.uid()
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'super_admin')
    ))
  );

-- "Users can self-enroll in free courses" only covered price = 0 courses.
-- Checkout.tsx's enrollAfterPayment() runs the *same* client-side
-- enrollments insert after a PAID course purchase completes -- add a
-- second permissive INSERT policy covering "I just paid for this course"
-- (a completed order + matching order_item for this exact course, owned
-- by me), so post-payment enrollment doesn't fail the same way.
DROP POLICY IF EXISTS "Users self-enroll after paid checkout" ON public.enrollments;
CREATE POLICY "Users self-enroll after paid checkout" ON public.enrollments
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      WHERE o.user_id = auth.uid()
        AND o.status = 'completed'
        AND oi.item_type = 'course'
        AND oi.item_id = enrollments.course_id
    )
  );
