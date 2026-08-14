-- enrollments had ZERO UPDATE policies at all (only INSERT/SELECT/DELETE).
-- With FORCE ROW LEVEL SECURITY and no UPDATE policy, every UPDATE to this
-- table -- for ANY role, including service_role -- silently affects 0 rows
-- (no error, since the row simply isn't visible to the UPDATE) rather than
-- failing loudly. Confirmed live: a service_role UPDATE setting
-- progress_pct=100 on a real enrollment row matched 0 rows.
--
-- This means useEnrollments.ts's lesson-completion handler
-- (.from('enrollments').update({ progress_pct, completed_at })) has been
-- silently no-op-ing on every single lesson completion, platform-wide --
-- student progress percentages shown on dashboards, instructor gradebooks,
-- and admin enrollment views never actually persisted past their initial
-- value. InstructorStudents.tsx's "Reset Progress" admin action was
-- equally broken. This is very likely the single highest-impact bug found
-- this session in terms of blast radius (every enrolled student, silently).
DROP POLICY IF EXISTS "Students and staff update enrollments" ON public.enrollments;
CREATE POLICY "Students and staff update enrollments" ON public.enrollments
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      user_id = auth.uid()
      OR can_manage_course(course_id)
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'super_admin')
    ))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      user_id = auth.uid()
      OR can_manage_course(course_id)
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'super_admin')
    ))
  );
