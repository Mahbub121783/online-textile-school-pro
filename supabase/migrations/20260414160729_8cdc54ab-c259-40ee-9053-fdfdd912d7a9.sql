CREATE TABLE IF NOT EXISTS public.batch_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.batches(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(batch_id, course_id)
);

ALTER TABLE public.batch_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view batch_courses"
  ON public.batch_courses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage batch_courses"
  ON public.batch_courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));