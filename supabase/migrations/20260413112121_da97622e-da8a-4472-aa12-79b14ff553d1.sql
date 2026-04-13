CREATE POLICY "Anyone can discover instructors"
ON public.user_roles FOR SELECT
USING (role = 'instructor'::app_role);