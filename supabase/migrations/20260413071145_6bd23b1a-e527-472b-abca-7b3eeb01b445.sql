-- Fix media_references: require authenticated + ownership or admin/instructor role
DROP POLICY IF EXISTS "Users insert own media refs" ON public.media_references;
CREATE POLICY "Users insert own media refs"
ON public.media_references
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'instructor'::app_role)
);

-- Fix registrations: require non-empty email
DROP POLICY IF EXISTS "Anyone can submit registration" ON public.registrations;
CREATE POLICY "Anyone can submit registration"
ON public.registrations
FOR INSERT
TO public
WITH CHECK (email IS NOT NULL AND length(trim(email)) > 0);