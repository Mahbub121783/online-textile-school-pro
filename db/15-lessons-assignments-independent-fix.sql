-- lessons: the ALL policy's EXISTS(...cs.id = lessons.section_id...) check
-- is unsatisfiable whenever section_id IS NULL, meaning nobody -- not even
-- admins -- could create/edit/delete an "Independent (No Course)" lesson,
-- despite LessonMakerTab.tsx's UI explicitly offering that as an option.
-- Add an admin/super_admin branch for the NULL case, matching the
-- equivalent precedent already used by quizzes for course_id IS NULL.
DROP POLICY IF EXISTS "Instructors manage lessons of their courses" ON public.lessons;
CREATE POLICY "Instructors manage lessons of their courses" ON public.lessons
  FOR ALL
  USING (
    auth.role() = 'authenticated' AND (
      (section_id IS NULL AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
      OR EXISTS (SELECT 1 FROM public.course_sections cs WHERE cs.id = lessons.section_id AND can_manage_course(cs.course_id))
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      (section_id IS NULL AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
      OR EXISTS (SELECT 1 FROM public.course_sections cs WHERE cs.id = lessons.section_id AND can_manage_course(cs.course_id))
    )
  );

-- assignments: the course_id IS NULL branch had no role check at all --
-- "(course_id IS NULL) OR can_manage_course(course_id)" means ANY
-- authenticated user (including students) could create/edit/delete
-- "independent" assignment rows. Restrict that branch to admin/super_admin,
-- matching quizzes' equivalent policy.
DROP POLICY IF EXISTS "Instructors manage assignments of their courses" ON public.assignments;
CREATE POLICY "Instructors manage assignments of their courses" ON public.assignments
  FOR ALL
  USING (
    auth.role() = 'authenticated' AND (
      (course_id IS NULL AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
      OR can_manage_course(course_id)
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      (course_id IS NULL AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
      OR can_manage_course(course_id)
    )
  );
