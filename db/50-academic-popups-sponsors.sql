-- Ports the "Academic" section (Batches, Academic Calendar, Grade Config,
-- Live Classes, Attendance, Plagiarism, Project Groups) plus the Popups and
-- Sponsors systems from the old (deleted) Supabase project's migration
-- history into the live self-hosted schema. These tables were fully built
-- in supabase/migrations/*.sql but were NEVER carried over into db/*.sql --
-- confirmed by grepping every table name across db/ (zero matches) -- so on
-- the live database every one of these tables simply doesn't exist yet.
-- Every admin page for these features was hitting a genuine
-- `relation "public.X" does not exist` error, surfacing as a raw 500 that
-- several pages then silently swallowed (no `error` check on the query),
-- rendering as an empty/broken screen with no explanation. This is not a
-- bug fix so much as finishing an incomplete migration.
--
-- RLS policies are mechanically rewritten from the originals' `TO
-- authenticated` + bare auth.uid()/has_role() checks to this project's
-- established `auth.role() = 'authenticated' AND (...)` AND-gate pattern
-- (see db/01-auth-shim.sql -- there are no real Postgres authenticated/anon
-- roles on this host, auth.role() reads a per-request session GUC instead).
-- Policies that were originally public (no TO clause) are left ungated.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- ============================================================
-- BATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.batches (
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

DROP POLICY IF EXISTS "Admins full access on batches" ON public.batches;
CREATE POLICY "Admins full access on batches" ON public.batches FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Students and instructors can view batches" ON public.batches;
CREATE POLICY "Students and instructors can view batches" ON public.batches FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_batches_updated_at ON public.batches;
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- BATCH_STUDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.batch_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  UNIQUE(batch_id, user_id)
);
ALTER TABLE public.batch_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access on batch_students" ON public.batch_students;
CREATE POLICY "Admins full access on batch_students" ON public.batch_students FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Students can view own batch assignments" ON public.batch_students;
CREATE POLICY "Students can view own batch assignments" ON public.batch_students FOR SELECT
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());

DROP POLICY IF EXISTS "Instructors can view batch students" ON public.batch_students;
CREATE POLICY "Instructors can view batch students" ON public.batch_students FOR SELECT
  USING (auth.role() = 'authenticated' AND public.has_role(auth.uid(), 'instructor'));

CREATE INDEX IF NOT EXISTS idx_batch_students_batch ON public.batch_students(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_students_user ON public.batch_students(user_id);

-- ============================================================
-- BATCH_COURSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.batch_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.batches(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(batch_id, course_id)
);
ALTER TABLE public.batch_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view batch_courses" ON public.batch_courses;
CREATE POLICY "Authenticated users can view batch_courses" ON public.batch_courses FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can manage batch_courses" ON public.batch_courses;
CREATE POLICY "Admins can manage batch_courses" ON public.batch_courses FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

-- ============================================================
-- ACADEMIC_CALENDAR
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academic_calendar (
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

DROP POLICY IF EXISTS "Admins full access on academic_calendar" ON public.academic_calendar;
CREATE POLICY "Admins full access on academic_calendar" ON public.academic_calendar FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Anyone can view global calendar events" ON public.academic_calendar;
CREATE POLICY "Anyone can view global calendar events" ON public.academic_calendar FOR SELECT
  USING (is_global = true);

DROP POLICY IF EXISTS "Students can view batch-specific calendar" ON public.academic_calendar;
CREATE POLICY "Students can view batch-specific calendar" ON public.academic_calendar FOR SELECT
  USING (
    auth.role() = 'authenticated' AND batch_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.batch_students WHERE batch_students.batch_id = academic_calendar.batch_id AND batch_students.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_academic_calendar_updated_at ON public.academic_calendar;
CREATE TRIGGER update_academic_calendar_updated_at BEFORE UPDATE ON public.academic_calendar
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_academic_calendar_dates ON public.academic_calendar(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_academic_calendar_batch ON public.academic_calendar(batch_id);

-- ============================================================
-- GRADE_CONFIGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.grade_configs (
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

DROP POLICY IF EXISTS "Admins full access on grade_configs" ON public.grade_configs;
CREATE POLICY "Admins full access on grade_configs" ON public.grade_configs FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Anyone can view grade configs" ON public.grade_configs;
CREATE POLICY "Anyone can view grade configs" ON public.grade_configs FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Default grading scale, seeded once (guarded so re-running this file never duplicates it).
INSERT INTO public.grade_configs (letter_grade, min_pct, max_pct, grade_point, sort_order)
SELECT * FROM (VALUES
  ('A+', 90::numeric, 100::numeric, 4.00::numeric, 1),
  ('A',  85, 89.99, 3.75, 2),
  ('A-', 80, 84.99, 3.50, 3),
  ('B+', 75, 79.99, 3.25, 4),
  ('B',  70, 74.99, 3.00, 5),
  ('B-', 65, 69.99, 2.75, 6),
  ('C+', 60, 64.99, 2.50, 7),
  ('C',  55, 59.99, 2.25, 8),
  ('D',  50, 54.99, 2.00, 9),
  ('F',  0,  49.99, 0.00, 10)
) AS v(letter_grade, min_pct, max_pct, grade_point, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.grade_configs);

-- ============================================================
-- STUDENT_GRADES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_grades (
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

DROP POLICY IF EXISTS "Admins full access on student_grades" ON public.student_grades;
CREATE POLICY "Admins full access on student_grades" ON public.student_grades FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Instructors can manage grades" ON public.student_grades;
CREATE POLICY "Instructors can manage grades" ON public.student_grades FOR ALL
  USING (auth.role() = 'authenticated' AND public.has_role(auth.uid(), 'instructor'))
  WITH CHECK (auth.role() = 'authenticated' AND public.has_role(auth.uid(), 'instructor'));

DROP POLICY IF EXISTS "Students can view own grades" ON public.student_grades;
CREATE POLICY "Students can view own grades" ON public.student_grades FOR SELECT
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());

DROP TRIGGER IF EXISTS update_student_grades_updated_at ON public.student_grades;
CREATE TRIGGER update_student_grades_updated_at BEFORE UPDATE ON public.student_grades
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_student_grades_user ON public.student_grades(user_id);
CREATE INDEX IF NOT EXISTS idx_student_grades_course ON public.student_grades(course_id);
CREATE INDEX IF NOT EXISTS idx_student_grades_batch ON public.student_grades(batch_id);
CREATE INDEX IF NOT EXISTS idx_student_grades_semester ON public.student_grades(semester);

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

-- ============================================================
-- LIVE_CLASSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.live_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  meeting_url text,
  platform text NOT NULL DEFAULT 'zoom',
  start_time timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  recording_url text,
  status text NOT NULL DEFAULT 'scheduled',
  created_by uuid REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.live_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access live_classes" ON public.live_classes;
CREATE POLICY "Admins full access live_classes" ON public.live_classes FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Instructors manage own live_classes" ON public.live_classes;
CREATE POLICY "Instructors manage own live_classes" ON public.live_classes FOR ALL
  USING (auth.role() = 'authenticated' AND created_by = auth.uid())
  WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated can view live_classes" ON public.live_classes;
CREATE POLICY "Authenticated can view live_classes" ON public.live_classes FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_live_classes_course ON public.live_classes(course_id);
CREATE INDEX IF NOT EXISTS idx_live_classes_batch ON public.live_classes(batch_id);
CREATE INDEX IF NOT EXISTS idx_live_classes_start ON public.live_classes(start_time);

DROP TRIGGER IF EXISTS update_live_classes_updated_at ON public.live_classes;
CREATE TRIGGER update_live_classes_updated_at BEFORE UPDATE ON public.live_classes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- ATTENDANCE_RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  check_in_time timestamptz,
  check_out_time timestamptz,
  status text NOT NULL DEFAULT 'absent',
  marked_by uuid REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(live_class_id, user_id)
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access attendance" ON public.attendance_records;
CREATE POLICY "Admins full access attendance" ON public.attendance_records FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Instructors manage attendance" ON public.attendance_records;
CREATE POLICY "Instructors manage attendance" ON public.attendance_records FOR ALL
  USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM public.live_classes lc WHERE lc.id = live_class_id AND lc.created_by = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM public.live_classes lc WHERE lc.id = live_class_id AND lc.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students view own attendance" ON public.attendance_records;
CREATE POLICY "Students view own attendance" ON public.attendance_records FOR SELECT
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_attendance_live_class ON public.attendance_records(live_class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON public.attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance_records(status);

-- ============================================================
-- PLAGIARISM_REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plagiarism_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.assignment_submissions(id) ON DELETE CASCADE,
  similarity_pct NUMERIC NOT NULL DEFAULT 0,
  matched_sources JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plagiarism_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage plagiarism reports" ON public.plagiarism_reports;
CREATE POLICY "Admins can manage plagiarism reports" ON public.plagiarism_reports FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Instructors can view plagiarism reports for their courses" ON public.plagiarism_reports;
CREATE POLICY "Instructors can view plagiarism reports for their courses" ON public.plagiarism_reports FOR SELECT
  USING (
    auth.role() = 'authenticated' AND public.has_role(auth.uid(), 'instructor') AND
    EXISTS (
      SELECT 1 FROM public.assignment_submissions asub
      JOIN public.assignments a ON a.id = asub.assignment_id
      JOIN public.courses c ON c.id = a.course_id
      WHERE asub.id = plagiarism_reports.submission_id AND c.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can view own plagiarism reports" ON public.plagiarism_reports;
CREATE POLICY "Students can view own plagiarism reports" ON public.plagiarism_reports FOR SELECT
  USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM public.assignment_submissions asub
      WHERE asub.id = plagiarism_reports.submission_id AND asub.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_submission ON public.plagiarism_reports(submission_id);
CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_status ON public.plagiarism_reports(status);

-- ============================================================
-- PROJECT_GROUPS / PROJECT_GROUP_MEMBERS / PROJECT_SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  max_members INTEGER NOT NULL DEFAULT 4,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage project groups" ON public.project_groups;
CREATE POLICY "Admins manage project groups" ON public.project_groups FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Instructors manage groups in their courses" ON public.project_groups;
CREATE POLICY "Instructors manage groups in their courses" ON public.project_groups FOR ALL
  USING (
    auth.role() = 'authenticated' AND public.has_role(auth.uid(), 'instructor') AND
    EXISTS (SELECT 1 FROM public.courses WHERE id = project_groups.course_id AND instructor_id = auth.uid())
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND public.has_role(auth.uid(), 'instructor') AND
    EXISTS (SELECT 1 FROM public.courses WHERE id = project_groups.course_id AND instructor_id = auth.uid())
  );

DROP POLICY IF EXISTS "Enrolled students can view groups" ON public.project_groups;
CREATE POLICY "Enrolled students can view groups" ON public.project_groups FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = project_groups.course_id AND user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_project_groups_course ON public.project_groups(course_id);

CREATE TABLE IF NOT EXISTS public.project_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.project_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
ALTER TABLE public.project_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage group members" ON public.project_group_members;
CREATE POLICY "Admins manage group members" ON public.project_group_members FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Instructors manage group members in their courses" ON public.project_group_members;
CREATE POLICY "Instructors manage group members in their courses" ON public.project_group_members FOR ALL
  USING (
    auth.role() = 'authenticated' AND public.has_role(auth.uid(), 'instructor') AND
    EXISTS (
      SELECT 1 FROM public.project_groups pg JOIN public.courses c ON c.id = pg.course_id
      WHERE pg.id = project_group_members.group_id AND c.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND public.has_role(auth.uid(), 'instructor') AND
    EXISTS (
      SELECT 1 FROM public.project_groups pg JOIN public.courses c ON c.id = pg.course_id
      WHERE pg.id = project_group_members.group_id AND c.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can view group members" ON public.project_group_members;
CREATE POLICY "Students can view group members" ON public.project_group_members FOR SELECT
  USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM public.project_groups pg JOIN public.enrollments e ON e.course_id = pg.course_id
      WHERE pg.id = project_group_members.group_id AND e.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_project_group_members_group ON public.project_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_project_group_members_user ON public.project_group_members(user_id);

CREATE TABLE IF NOT EXISTS public.project_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.project_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  submitted_by UUID NOT NULL REFERENCES public.user_profiles(id),
  score NUMERIC,
  feedback TEXT,
  graded_by UUID REFERENCES public.user_profiles(id),
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage project submissions" ON public.project_submissions;
CREATE POLICY "Admins manage project submissions" ON public.project_submissions FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Instructors manage submissions in their courses" ON public.project_submissions;
CREATE POLICY "Instructors manage submissions in their courses" ON public.project_submissions FOR ALL
  USING (
    auth.role() = 'authenticated' AND public.has_role(auth.uid(), 'instructor') AND
    EXISTS (
      SELECT 1 FROM public.project_groups pg JOIN public.courses c ON c.id = pg.course_id
      WHERE pg.id = project_submissions.group_id AND c.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND public.has_role(auth.uid(), 'instructor') AND
    EXISTS (
      SELECT 1 FROM public.project_groups pg JOIN public.courses c ON c.id = pg.course_id
      WHERE pg.id = project_submissions.group_id AND c.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Group members can view and create submissions" ON public.project_submissions;
CREATE POLICY "Group members can view submissions" ON public.project_submissions FOR SELECT
  USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM public.project_group_members pgm WHERE pgm.group_id = project_submissions.group_id AND pgm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Group members can insert submissions" ON public.project_submissions;
CREATE POLICY "Group members can insert submissions" ON public.project_submissions FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.project_group_members pgm WHERE pgm.group_id = project_submissions.group_id AND pgm.user_id = auth.uid())
    AND submitted_by = auth.uid()
  );

CREATE INDEX IF NOT EXISTS idx_project_submissions_group ON public.project_submissions(group_id);

DROP TRIGGER IF EXISTS update_project_groups_updated_at ON public.project_groups;
CREATE TRIGGER update_project_groups_updated_at BEFORE UPDATE ON public.project_groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_project_submissions_updated_at ON public.project_submissions;
CREATE TRIGGER update_project_submissions_updated_at BEFORE UPDATE ON public.project_submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- SPONSORS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text NOT NULL,
  website_url text,
  tier text DEFAULT 'silver' CHECK (tier IN ('platinum','gold','silver','bronze')),
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  click_count integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active sponsors" ON public.sponsors;
CREATE POLICY "Public read active sponsors" ON public.sponsors FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admin manage sponsors" ON public.sponsors;
CREATE POLICY "Admin manage sponsors" ON public.sponsors FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP TRIGGER IF EXISTS update_sponsors_updated_at ON public.sponsors;
CREATE TRIGGER update_sponsors_updated_at BEFORE UPDATE ON public.sponsors
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- POPUPS / POPUP_SUBMISSIONS / POPUP_ANALYTICS
-- (includes the follow-up column additions from the old project's second
-- popups migration, folded directly into this CREATE TABLE since the table
-- doesn't exist yet on this database -- no separate ALTER step needed.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.popups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  type TEXT NOT NULL DEFAULT 'announcement',
  title TEXT,
  subtitle TEXT,
  body_content TEXT,
  image_url TEXT,
  video_url TEXT,
  background_color TEXT DEFAULT '#ffffff',
  text_color TEXT DEFAULT '#0f172a',
  accent_color TEXT DEFAULT '#3b82f6',
  cta_primary_label TEXT,
  cta_primary_url TEXT,
  cta_secondary_label TEXT,
  cta_secondary_url TEXT,
  layout TEXT NOT NULL DEFAULT 'center_modal',
  size TEXT NOT NULL DEFAULT 'md',
  animation TEXT NOT NULL DEFAULT 'fade',
  trigger_type TEXT NOT NULL DEFAULT 'delay',
  trigger_value INTEGER NOT NULL DEFAULT 3,
  target_pages TEXT[] DEFAULT ARRAY['/']::TEXT[],
  exclude_pages TEXT[] DEFAULT ARRAY[]::TEXT[],
  target_devices TEXT NOT NULL DEFAULT 'all',
  target_user_state TEXT NOT NULL DEFAULT 'all',
  frequency TEXT NOT NULL DEFAULT 'once',
  frequency_value INTEGER DEFAULT 1,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  countdown_target_date TIMESTAMPTZ,
  form_fields JSONB DEFAULT '[]'::jsonb,
  priority INTEGER NOT NULL DEFAULT 0,
  background_video_url TEXT,
  background_video_overlay_opacity NUMERIC DEFAULT 0.5,
  countdown_source TEXT DEFAULT 'manual',
  countdown_source_id UUID,
  countdown_source_field TEXT,
  countdown_expired_action TEXT DEFAULT 'hide',
  countdown_expired_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_popups_active ON public.popups(is_active, priority DESC);

CREATE TABLE IF NOT EXISTS public.popup_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  popup_id UUID NOT NULL REFERENCES public.popups(id) ON DELETE CASCADE,
  user_id UUID,
  email TEXT,
  form_data JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_popup_submissions_popup ON public.popup_submissions(popup_id);

CREATE TABLE IF NOT EXISTS public.popup_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  popup_id UUID NOT NULL REFERENCES public.popups(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  user_id UUID,
  session_id TEXT,
  page_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_popup_analytics_popup ON public.popup_analytics(popup_id, event_type);
CREATE INDEX IF NOT EXISTS idx_popup_analytics_created ON public.popup_analytics(created_at DESC);

ALTER TABLE public.popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popup_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popup_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active popups" ON public.popups;
CREATE POLICY "Anyone can view active popups" ON public.popups FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can view all popups" ON public.popups;
CREATE POLICY "Admins can view all popups" ON public.popups FOR SELECT
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Admins can insert popups" ON public.popups;
CREATE POLICY "Admins can insert popups" ON public.popups FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Admins can update popups" ON public.popups;
CREATE POLICY "Admins can update popups" ON public.popups FOR UPDATE
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Admins can delete popups" ON public.popups;
CREATE POLICY "Admins can delete popups" ON public.popups FOR DELETE
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Anyone can submit popup forms" ON public.popup_submissions;
CREATE POLICY "Anyone can submit popup forms" ON public.popup_submissions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own submissions" ON public.popup_submissions;
CREATE POLICY "Users can view own submissions" ON public.popup_submissions FOR SELECT
  USING (auth.role() = 'authenticated' AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all submissions" ON public.popup_submissions;
CREATE POLICY "Admins can view all submissions" ON public.popup_submissions FOR SELECT
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Admins can delete submissions" ON public.popup_submissions;
CREATE POLICY "Admins can delete submissions" ON public.popup_submissions FOR DELETE
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Anyone can record popup analytics" ON public.popup_analytics;
CREATE POLICY "Anyone can record popup analytics" ON public.popup_analytics FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all analytics" ON public.popup_analytics;
CREATE POLICY "Admins can view all analytics" ON public.popup_analytics FOR SELECT
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))));

DROP TRIGGER IF EXISTS update_popups_updated_at ON public.popups;
CREATE TRIGGER update_popups_updated_at BEFORE UPDATE ON public.popups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
