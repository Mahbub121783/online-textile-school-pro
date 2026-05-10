-- 1. workshops.meet_link
REVOKE SELECT (meet_link) ON public.workshops FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_workshop_meet_link(_workshop_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _link text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') THEN
    SELECT meet_link INTO _link FROM public.workshops WHERE id = _workshop_id;
    RETURN _link;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.workshop_registrations
    WHERE workshop_id = _workshop_id AND user_id = auth.uid() AND status = 'registered'
  ) OR EXISTS (
    SELECT 1 FROM public.workshops WHERE id = _workshop_id AND instructor_id = auth.uid()
  ) THEN
    SELECT meet_link INTO _link FROM public.workshops WHERE id = _workshop_id;
    RETURN _link;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_workshop_meet_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workshop_meet_link(uuid) TO authenticated;

-- 2. lessons
DROP POLICY IF EXISTS "Anyone can view lessons" ON public.lessons;
CREATE POLICY "View lessons when entitled"
ON public.lessons FOR SELECT TO public
USING (
  is_preview = true
  OR EXISTS (
    SELECT 1 FROM public.course_sections cs
    JOIN public.enrollments e ON e.course_id = cs.course_id
    WHERE cs.id = lessons.section_id AND e.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.course_sections cs
    JOIN public.courses c ON c.id = cs.course_id
    WHERE cs.id = lessons.section_id AND c.instructor_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- 3. quiz_questions
DROP POLICY IF EXISTS "Authenticated can view questions" ON public.quiz_questions;
CREATE POLICY "View quiz questions when enrolled or staff"
ON public.quiz_questions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'instructor')
  OR EXISTS (
    SELECT 1 FROM public.quizzes q
    LEFT JOIN public.enrollments e ON e.course_id = q.course_id
    WHERE q.id = quiz_questions.quiz_id
      AND (q.course_id IS NULL OR e.user_id = auth.uid())
  )
);

-- 4. faculty_members
REVOKE SELECT (email, phone) ON public.faculty_members FROM anon;

-- 5. user_profiles sensitive PII
REVOKE SELECT (phone, whatsapp_number, date_of_birth, blood_group, latitude, longitude, district, division, upazila)
  ON public.user_profiles FROM anon;