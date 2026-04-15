
-- Add instructor_id to workshops (links to user_profiles instead of manual name/bio/avatar)
ALTER TABLE public.workshops ADD COLUMN instructor_id uuid REFERENCES public.user_profiles(id);

-- Workshop lessons / curriculum table
CREATE TABLE public.workshop_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid REFERENCES public.workshops(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  content text,
  lesson_type text DEFAULT 'lecture',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.workshop_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read workshop_lessons" ON public.workshop_lessons
  FOR SELECT USING (true);

CREATE POLICY "Admin manage workshop_lessons" ON public.workshop_lessons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
