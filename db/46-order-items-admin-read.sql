-- order_items had no admin-bypass SELECT policy at all (only service_role
-- or the owning user via orders.user_id = auth.uid()) -- unlike orders,
-- which already had one. Found while verifying the embedded-filter query
-- fix: AdminEbooks.tsx's revenue/unique-buyers stats query can only ever
-- see order_items belonging to the admin's own account, so it silently
-- showed 0 revenue / 0 buyers for every ebook regardless of real sales.
-- Postgres OR-combines multiple permissive SELECT policies automatically,
-- so this only needs to add the missing admin condition.
DROP POLICY IF EXISTS "Admins read all order items" ON public.order_items;
CREATE POLICY "Admins read all order items" ON public.order_items
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  );
