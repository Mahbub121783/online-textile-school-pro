-- Add missing policies to existing reviews table (skip if they already exist)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Enrolled users can insert reviews') THEN
    CREATE POLICY "Enrolled users can insert reviews"
    ON public.reviews FOR INSERT TO authenticated
    WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = reviews.course_id AND e.user_id = auth.uid())
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Users can update own reviews') THEN
    CREATE POLICY "Users can update own reviews"
    ON public.reviews FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Users or admins can delete reviews') THEN
    CREATE POLICY "Users or admins can delete reviews"
    ON public.reviews FOR DELETE TO authenticated
    USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
  END IF;
END $$;