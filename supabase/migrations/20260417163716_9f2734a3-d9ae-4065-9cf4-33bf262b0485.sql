-- 1. Add created_by to ebooks
ALTER TABLE public.ebooks
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ebooks_created_by ON public.ebooks(created_by);

-- 2. Backfill created_by from content_contributors (first author found)
UPDATE public.ebooks e
SET created_by = cc.user_id
FROM (
  SELECT DISTINCT ON (content_id) content_id, user_id
  FROM public.content_contributors
  WHERE content_type = 'ebook'
  ORDER BY content_id, sort_order ASC, created_at ASC
) cc
WHERE cc.content_id = e.id
  AND e.created_by IS NULL;

-- 3. Helper: can current user manage a course's content?
CREATE OR REPLACE FUNCTION public.can_manage_course(_course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.courses WHERE id = _course_id AND instructor_id = auth.uid()) THEN
    RETURN true;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.content_contributors
    WHERE content_type = 'course' AND content_id = _course_id AND user_id = auth.uid()
      AND role IN ('lead_instructor','co_instructor','instructor')
  ) THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- 4. RLS: ebooks
ALTER TABLE public.ebooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors manage own ebooks" ON public.ebooks;
CREATE POLICY "Instructors manage own ebooks"
ON public.ebooks
FOR ALL
TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- 5. RLS: course_sections
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Instructors manage sections of their courses" ON public.course_sections;
CREATE POLICY "Instructors manage sections of their courses"
ON public.course_sections FOR ALL TO authenticated
USING (public.can_manage_course(course_id))
WITH CHECK (public.can_manage_course(course_id));

-- 6. RLS: lessons (via section -> course)
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Instructors manage lessons of their courses" ON public.lessons;
CREATE POLICY "Instructors manage lessons of their courses"
ON public.lessons FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.course_sections cs
    WHERE cs.id = lessons.section_id AND public.can_manage_course(cs.course_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.course_sections cs
    WHERE cs.id = lessons.section_id AND public.can_manage_course(cs.course_id)
  )
);

-- 7. RLS: assignments
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Instructors manage assignments of their courses" ON public.assignments;
CREATE POLICY "Instructors manage assignments of their courses"
ON public.assignments FOR ALL TO authenticated
USING (course_id IS NULL OR public.can_manage_course(course_id))
WITH CHECK (course_id IS NULL OR public.can_manage_course(course_id));

-- 8. RLS: quizzes (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='quizzes') THEN
    EXECUTE 'ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Instructors manage quizzes of their courses" ON public.quizzes';
    EXECUTE $POL$
      CREATE POLICY "Instructors manage quizzes of their courses"
      ON public.quizzes FOR ALL TO authenticated
      USING (course_id IS NULL OR public.can_manage_course(course_id))
      WITH CHECK (course_id IS NULL OR public.can_manage_course(course_id))
    $POL$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='quiz_questions') THEN
    EXECUTE 'ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Instructors manage quiz questions of their courses" ON public.quiz_questions';
    EXECUTE $POL$
      CREATE POLICY "Instructors manage quiz questions of their courses"
      ON public.quiz_questions FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.quizzes q
          WHERE q.id = quiz_questions.quiz_id
            AND (q.course_id IS NULL OR public.can_manage_course(q.course_id))
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.quizzes q
          WHERE q.id = quiz_questions.quiz_id
            AND (q.course_id IS NULL OR public.can_manage_course(q.course_id))
        )
      )
    $POL$;
  END IF;
END $$;