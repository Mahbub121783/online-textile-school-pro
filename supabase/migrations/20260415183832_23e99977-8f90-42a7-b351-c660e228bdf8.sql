-- Allow admins and super_admins to insert orders on behalf of students (e.g. granting ebooks)
CREATE POLICY "Admins can insert orders"
ON public.orders FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);