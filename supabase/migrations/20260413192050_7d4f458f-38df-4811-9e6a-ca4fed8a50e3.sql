
-- 1. Create live_classes table
CREATE TABLE public.live_classes (
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

CREATE POLICY "Admins full access live_classes"
  ON public.live_classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Instructors manage own live_classes"
  ON public.live_classes FOR ALL TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Authenticated can view live_classes"
  ON public.live_classes FOR SELECT TO authenticated
  USING (true);

CREATE INDEX idx_live_classes_course ON public.live_classes(course_id);
CREATE INDEX idx_live_classes_batch ON public.live_classes(batch_id);
CREATE INDEX idx_live_classes_start ON public.live_classes(start_time);

CREATE TRIGGER update_live_classes_updated_at
  BEFORE UPDATE ON public.live_classes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Create attendance_records table
CREATE TABLE public.attendance_records (
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

CREATE POLICY "Admins full access attendance"
  ON public.attendance_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Instructors manage attendance"
  ON public.attendance_records FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_classes lc
      WHERE lc.id = live_class_id AND lc.created_by = auth.uid()
    )
  );

CREATE POLICY "Students view own attendance"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_attendance_live_class ON public.attendance_records(live_class_id);
CREATE INDEX idx_attendance_user ON public.attendance_records(user_id);
CREATE INDEX idx_attendance_status ON public.attendance_records(status);
