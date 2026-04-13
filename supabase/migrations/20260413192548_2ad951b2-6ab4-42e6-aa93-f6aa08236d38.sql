
-- 1. Create faculty_members table
CREATE TABLE public.faculty_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  designation text,
  department text,
  bio text,
  photo_url text,
  email text,
  phone text,
  specialization text,
  sort_order integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.faculty_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active faculty"
  ON public.faculty_members FOR SELECT USING (is_active = true);

CREATE POLICY "Admins manage faculty"
  ON public.faculty_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_faculty_department ON public.faculty_members(department);
CREATE INDEX idx_faculty_sort ON public.faculty_members(sort_order);

CREATE TRIGGER update_faculty_updated_at
  BEFORE UPDATE ON public.faculty_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Create sms_logs table
CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone text NOT NULL,
  message text NOT NULL,
  template_key text,
  status text NOT NULL DEFAULT 'pending',
  provider_response jsonb,
  user_id uuid REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sms_logs"
  ON public.sms_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_sms_logs_status ON public.sms_logs(status);
