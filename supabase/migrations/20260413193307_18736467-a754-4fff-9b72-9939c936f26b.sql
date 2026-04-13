
-- =============================================
-- Phase 5: Academic Integrity & Assessment
-- =============================================

-- 1. Plagiarism Reports
CREATE TABLE public.plagiarism_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.assignment_submissions(id) ON DELETE CASCADE,
  similarity_pct NUMERIC NOT NULL DEFAULT 0,
  matched_sources JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plagiarism_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage plagiarism reports"
  ON public.plagiarism_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Instructors can view plagiarism reports for their courses"
  ON public.plagiarism_reports FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'instructor') AND
    EXISTS (
      SELECT 1 FROM assignment_submissions asub
      JOIN assignments a ON a.id = asub.assignment_id
      JOIN courses c ON c.id = a.course_id
      WHERE asub.id = plagiarism_reports.submission_id
        AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Students can view own plagiarism reports"
  ON public.plagiarism_reports FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignment_submissions asub
      WHERE asub.id = plagiarism_reports.submission_id
        AND asub.user_id = auth.uid()
    )
  );

CREATE INDEX idx_plagiarism_reports_submission ON public.plagiarism_reports(submission_id);
CREATE INDEX idx_plagiarism_reports_status ON public.plagiarism_reports(status);

-- 2. Project Groups
CREATE TABLE public.project_groups (
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

CREATE POLICY "Admins manage project groups"
  ON public.project_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Instructors manage groups in their courses"
  ON public.project_groups FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'instructor') AND
    EXISTS (SELECT 1 FROM courses WHERE id = project_groups.course_id AND instructor_id = auth.uid())
  );

CREATE POLICY "Enrolled students can view groups"
  ON public.project_groups FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM enrollments WHERE course_id = project_groups.course_id AND user_id = auth.uid())
  );

CREATE INDEX idx_project_groups_course ON public.project_groups(course_id);

-- 3. Project Group Members
CREATE TABLE public.project_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.project_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.project_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage group members"
  ON public.project_group_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Instructors manage group members in their courses"
  ON public.project_group_members FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'instructor') AND
    EXISTS (
      SELECT 1 FROM project_groups pg
      JOIN courses c ON c.id = pg.course_id
      WHERE pg.id = project_group_members.group_id AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Students can view group members"
  ON public.project_group_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_groups pg
      JOIN enrollments e ON e.course_id = pg.course_id
      WHERE pg.id = project_group_members.group_id AND e.user_id = auth.uid()
    )
  );

CREATE INDEX idx_project_group_members_group ON public.project_group_members(group_id);
CREATE INDEX idx_project_group_members_user ON public.project_group_members(user_id);

-- 4. Project Submissions
CREATE TABLE public.project_submissions (
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

CREATE POLICY "Admins manage project submissions"
  ON public.project_submissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Instructors manage submissions in their courses"
  ON public.project_submissions FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'instructor') AND
    EXISTS (
      SELECT 1 FROM project_groups pg
      JOIN courses c ON c.id = pg.course_id
      WHERE pg.id = project_submissions.group_id AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Group members can view and create submissions"
  ON public.project_submissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_group_members pgm
      WHERE pgm.group_id = project_submissions.group_id AND pgm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can insert submissions"
  ON public.project_submissions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_group_members pgm
      WHERE pgm.group_id = project_submissions.group_id AND pgm.user_id = auth.uid()
    )
    AND submitted_by = auth.uid()
  );

CREATE INDEX idx_project_submissions_group ON public.project_submissions(group_id);

-- 5. Add plagiarism threshold to site_settings (using existing settings table)
-- We'll store it as a site_content key instead

-- Triggers for updated_at
CREATE TRIGGER update_project_groups_updated_at
  BEFORE UPDATE ON public.project_groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_project_submissions_updated_at
  BEFORE UPDATE ON public.project_submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
