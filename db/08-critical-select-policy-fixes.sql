-- ============================================================
-- Full RLS coverage audit (post-cutover) found several tables with ZERO
-- SELECT-capable policies -- meaning literally nobody, including the row's
-- own owner, can read them. These are guaranteed breakage for core LMS
-- flows (enrollment status, course curriculum, reviews, quizzes,
-- assignments). Discovered via:
--   SELECT c.relname, count(p.policyname) FILTER (WHERE p.cmd IN
--   ('SELECT','ALL')) FROM pg_class c LEFT JOIN pg_policies p ...
--   GROUP BY c.relname HAVING count(...) = 0;
--
-- course_sections is the most severe: it had only an instructor-only ALL
-- policy, no public/enrolled SELECT. Because lessons.SELECT policy
-- ("View lessons when entitled") itself does
--   EXISTS (SELECT 1 FROM course_sections cs JOIN enrollments e ...)
-- and course_sections has FORCE ROW LEVEL SECURITY (the connecting role is
-- also table owner, see 04-force-rls.sql), that subquery is ALSO subject to
-- course_sections' RLS -- so with no student-visible policy on
-- course_sections, the subquery returned zero rows for every student,
-- silently denying lesson access even to legitimately enrolled users. This
-- was blocking the entire video-player / lesson-viewing feature.
-- ============================================================

-- enrollments: student's own enrollments, the course's instructor, and
-- admins/service_role need to read this (dashboard MyCourses, "already
-- enrolled" checks, LessonPlayer entitlement checks upstream of lessons'
-- own policy).
CREATE POLICY "Users and instructors read enrollments" ON public.enrollments
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = enrollments.course_id AND c.instructor_id = auth.uid())
    OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)
    OR auth.role() = 'service_role'
  );

-- reviews: public product reviews, same visibility model as the course
-- itself -- readable by anyone (rating/comment text is not sensitive).
CREATE POLICY "Public read reviews" ON public.reviews
  FOR SELECT USING (true);

-- course_sections: syllabus/curriculum should be visible to anyone browsing
-- a published course (pre-purchase preview, matches courses' own "Public
-- read published courses" policy), to enrolled students, and to the
-- instructor/admin. This also unblocks the lessons-table nested subquery
-- described above.
CREATE POLICY "View sections when entitled" ON public.course_sections
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_sections.course_id AND c.is_published = true)
    OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = course_sections.course_id AND e.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_sections.course_id AND c.instructor_id = auth.uid())
    OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)
    OR auth.role() = 'service_role'
  );

-- assignments / quizzes: only enrolled students (not public browsers --
-- these are graded assessments, not marketing preview content) plus the
-- managing instructor/admin should be able to read assignment/quiz content.
CREATE POLICY "View assignments when entitled" ON public.assignments
  FOR SELECT USING (
    course_id IS NULL
    OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = assignments.course_id AND e.user_id = auth.uid())
    OR can_manage_course(course_id)
    OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)
    OR auth.role() = 'service_role'
  );

CREATE POLICY "View quizzes when entitled" ON public.quizzes
  FOR SELECT USING (
    course_id IS NULL
    OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = quizzes.course_id AND e.user_id = auth.uid())
    OR can_manage_course(course_id)
    OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)
    OR auth.role() = 'service_role'
  );

-- media_references: internal media-library usage-tracking table (which
-- library items are referenced where). Only had an INSERT policy. Scoped
-- read to the uploader/instructor/admin, matching media_library's own
-- access model -- not public data.
CREATE POLICY "Owners and admins read media refs" ON public.media_references
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      owner_id = auth.uid()
      OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'instructor'::app_role)
    )
  );
