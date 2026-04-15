-- Drop the broken policy that references auth.users
DROP POLICY IF EXISTS "Users can view own registrations" ON public.workshop_registrations;

-- Recreate using auth.jwt() instead of querying auth.users
CREATE POLICY "Users can view own registrations"
ON public.workshop_registrations
FOR SELECT
TO public
USING (
  user_id = auth.uid()
  OR email = (auth.jwt() ->> 'email')
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);