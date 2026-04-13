
-- =============================================
-- Phase 6: Career & Research
-- =============================================

-- 1. Internships
CREATE TABLE public.internships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  stipend TEXT,
  duration TEXT,
  application_deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  posted_by UUID REFERENCES public.user_profiles(id),
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.internships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage internships"
  ON public.internships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Everyone can view published internships"
  ON public.internships FOR SELECT
  USING (is_published = true AND status = 'open');

CREATE INDEX idx_internships_status ON public.internships(status);
CREATE INDEX idx_internships_deadline ON public.internships(application_deadline);

CREATE TRIGGER update_internships_updated_at
  BEFORE UPDATE ON public.internships
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Internship Applications
CREATE TABLE public.internship_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  internship_id UUID NOT NULL REFERENCES public.internships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  cover_letter TEXT,
  resume_url TEXT,
  status TEXT NOT NULL DEFAULT 'applied',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(internship_id, user_id)
);

ALTER TABLE public.internship_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage applications"
  ON public.internship_applications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Students can view own applications"
  ON public.internship_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Students can create applications"
  ON public.internship_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Students can update own applications"
  ON public.internship_applications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_internship_apps_user ON public.internship_applications(user_id);
CREATE INDEX idx_internship_apps_internship ON public.internship_applications(internship_id);
CREATE INDEX idx_internship_apps_status ON public.internship_applications(status);

CREATE TRIGGER update_internship_apps_updated_at
  BEFORE UPDATE ON public.internship_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Research Papers
CREATE TABLE public.research_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  abstract TEXT,
  authors JSONB DEFAULT '[]'::jsonb,
  file_url TEXT,
  category TEXT,
  keywords TEXT,
  published_date DATE,
  download_count INTEGER NOT NULL DEFAULT 0,
  submitted_by UUID REFERENCES public.user_profiles(id),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.research_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage research papers"
  ON public.research_papers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Everyone can view approved papers"
  ON public.research_papers FOR SELECT
  USING (is_approved = true);

CREATE POLICY "Users can view own submissions"
  ON public.research_papers FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

CREATE POLICY "Users can submit papers"
  ON public.research_papers FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Users can update own pending papers"
  ON public.research_papers FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND is_approved = false)
  WITH CHECK (submitted_by = auth.uid());

CREATE INDEX idx_research_papers_category ON public.research_papers(category);
CREATE INDEX idx_research_papers_approved ON public.research_papers(is_approved);

CREATE TRIGGER update_research_papers_updated_at
  BEFORE UPDATE ON public.research_papers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Virtual Labs
CREATE TABLE public.virtual_labs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  simulation_url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'iframe',
  instructions TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.virtual_labs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage virtual labs"
  ON public.virtual_labs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Instructors manage labs for their courses"
  ON public.virtual_labs FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'instructor') AND
    EXISTS (SELECT 1 FROM courses WHERE id = virtual_labs.course_id AND instructor_id = auth.uid())
  );

CREATE POLICY "Everyone can view published labs"
  ON public.virtual_labs FOR SELECT
  USING (is_published = true);

CREATE INDEX idx_virtual_labs_course ON public.virtual_labs(course_id);
CREATE INDEX idx_virtual_labs_published ON public.virtual_labs(is_published);

CREATE TRIGGER update_virtual_labs_updated_at
  BEFORE UPDATE ON public.virtual_labs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
