
-- ============================================
-- BATCHES TABLE
-- ============================================
CREATE TABLE public.batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'archived')),
  max_students INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on batches" ON public.batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Students and instructors can view batches" ON public.batches FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- BATCH_STUDENTS TABLE
-- ============================================
CREATE TABLE public.batch_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  UNIQUE(batch_id, user_id)
);

ALTER TABLE public.batch_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on batch_students" ON public.batch_students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Students can view own batch assignments" ON public.batch_students FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Instructors can view batch students" ON public.batch_students FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'instructor'));

CREATE INDEX idx_batch_students_batch ON public.batch_students(batch_id);
CREATE INDEX idx_batch_students_user ON public.batch_students(user_id);

-- ============================================
-- ACADEMIC_CALENDAR TABLE
-- ============================================
CREATE TABLE public.academic_calendar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'other' CHECK (event_type IN ('semester_start', 'semester_end', 'exam_week', 'holiday', 'deadline', 'registration', 'other')),
  start_date DATE NOT NULL,
  end_date DATE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  is_global BOOLEAN NOT NULL DEFAULT true,
  color TEXT DEFAULT '#3b82f6',
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.academic_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on academic_calendar" ON public.academic_calendar FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Anyone can view global calendar events" ON public.academic_calendar FOR SELECT
  USING (is_global = true);

CREATE POLICY "Students can view batch-specific calendar" ON public.academic_calendar FOR SELECT TO authenticated
  USING (
    batch_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.batch_students WHERE batch_students.batch_id = academic_calendar.batch_id AND batch_students.user_id = auth.uid()
    )
  );

CREATE TRIGGER update_academic_calendar_updated_at BEFORE UPDATE ON public.academic_calendar
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_academic_calendar_dates ON public.academic_calendar(start_date, end_date);
CREATE INDEX idx_academic_calendar_batch ON public.academic_calendar(batch_id);

-- ============================================
-- GRADE_CONFIGS TABLE
-- ============================================
CREATE TABLE public.grade_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  letter_grade TEXT NOT NULL,
  min_pct NUMERIC(5,2) NOT NULL,
  max_pct NUMERIC(5,2) NOT NULL,
  grade_point NUMERIC(3,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.grade_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on grade_configs" ON public.grade_configs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Anyone can view grade configs" ON public.grade_configs FOR SELECT TO authenticated
  USING (true);

-- Insert default grading scale
INSERT INTO public.grade_configs (letter_grade, min_pct, max_pct, grade_point, sort_order) VALUES
  ('A+', 90, 100, 4.00, 1),
  ('A',  85, 89.99, 3.75, 2),
  ('A-', 80, 84.99, 3.50, 3),
  ('B+', 75, 79.99, 3.25, 4),
  ('B',  70, 74.99, 3.00, 5),
  ('B-', 65, 69.99, 2.75, 6),
  ('C+', 60, 64.99, 2.50, 7),
  ('C',  55, 59.99, 2.25, 8),
  ('D',  50, 54.99, 2.00, 9),
  ('F',  0,  49.99, 0.00, 10);

-- ============================================
-- STUDENT_GRADES TABLE
-- ============================================
CREATE TABLE public.student_grades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  letter_grade TEXT NOT NULL,
  grade_point NUMERIC(3,2) NOT NULL,
  credits NUMERIC(4,2) NOT NULL DEFAULT 3.00,
  semester TEXT,
  percentage NUMERIC(5,2),
  notes TEXT,
  graded_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on student_grades" ON public.student_grades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Instructors can manage grades" ON public.student_grades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'instructor'))
  WITH CHECK (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Students can view own grades" ON public.student_grades FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_student_grades_updated_at BEFORE UPDATE ON public.student_grades
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_student_grades_user ON public.student_grades(user_id);
CREATE INDEX idx_student_grades_course ON public.student_grades(course_id);
CREATE INDEX idx_student_grades_batch ON public.student_grades(batch_id);
CREATE INDEX idx_student_grades_semester ON public.student_grades(semester);

-- ============================================
-- Add preferred_language to user_profiles for Phase 4 prep
-- ============================================
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';
