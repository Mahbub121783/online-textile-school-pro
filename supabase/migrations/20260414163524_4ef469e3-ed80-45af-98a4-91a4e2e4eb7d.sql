
-- Extend internships table
ALTER TABLE public.internships
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS internship_type text NOT NULL DEFAULT 'onsite',
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS positions_available integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS positions_filled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skills_required text[],
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Extend internship_applications table
ALTER TABLE public.internship_applications
  ADD COLUMN IF NOT EXISTS portfolio_url text,
  ADD COLUMN IF NOT EXISTS skills text[],
  ADD COLUMN IF NOT EXISTS availability_date date,
  ADD COLUMN IF NOT EXISTS interview_date timestamptz,
  ADD COLUMN IF NOT EXISTS interview_notes text,
  ADD COLUMN IF NOT EXISTS rating integer,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.user_profiles(id);

-- Create internship_tasks table
CREATE TABLE IF NOT EXISTS public.internship_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internship_id uuid NOT NULL REFERENCES public.internships(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.internship_applications(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  due_date date,
  submitted_at timestamptz,
  submission_url text,
  feedback text,
  assigned_by uuid REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internship_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage internship tasks"
  ON public.internship_tasks FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Supervisors manage tasks for their internships"
  ON public.internship_tasks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.internships i
      WHERE i.id = internship_tasks.internship_id AND i.supervisor_id = auth.uid()
    )
  );

CREATE POLICY "Users view own tasks"
  ON public.internship_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.internship_applications a
      WHERE a.id = internship_tasks.application_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Users update own task submissions"
  ON public.internship_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.internship_applications a
      WHERE a.id = internship_tasks.application_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.internship_applications a
      WHERE a.id = internship_tasks.application_id AND a.user_id = auth.uid()
    )
  );

-- Create internship_logs table
CREATE TABLE IF NOT EXISTS public.internship_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.internship_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id),
  log_date date NOT NULL,
  hours_worked numeric NOT NULL DEFAULT 0,
  activities text NOT NULL DEFAULT '',
  learnings text,
  supervisor_feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internship_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage internship logs"
  ON public.internship_logs FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Users manage own logs"
  ON public.internship_logs FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Supervisors view logs for their internships"
  ON public.internship_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.internship_applications a
      JOIN public.internships i ON i.id = a.internship_id
      WHERE a.id = internship_logs.application_id AND i.supervisor_id = auth.uid()
    )
  );

CREATE POLICY "Supervisors add feedback to logs"
  ON public.internship_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.internship_applications a
      JOIN public.internships i ON i.id = a.internship_id
      WHERE a.id = internship_logs.application_id AND i.supervisor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.internship_applications a
      JOIN public.internships i ON i.id = a.internship_id
      WHERE a.id = internship_logs.application_id AND i.supervisor_id = auth.uid()
    )
  );

-- Helper function to increment internship view count
CREATE OR REPLACE FUNCTION public.increment_internship_view(_internship_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE internships SET view_count = COALESCE(view_count, 0) + 1 WHERE id = _internship_id;
$$;
