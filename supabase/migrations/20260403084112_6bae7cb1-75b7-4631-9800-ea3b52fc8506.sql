
-- Table: registration_purposes
CREATE TABLE public.registration_purposes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  max_entries integer,
  photo_required boolean DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer DEFAULT 0,
  custom_fields jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.registration_purposes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active purposes" ON public.registration_purposes
  FOR SELECT TO public USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins manage purposes" ON public.registration_purposes
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Table: registration_form_config (singleton)
CREATE TABLE public.registration_form_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fields_order jsonb DEFAULT '["full_name","email","mobile","blood_group","university","batch"]'::jsonb,
  page_title text DEFAULT 'Register',
  page_subtitle text,
  banner_url text,
  event_details text,
  countdown_target timestamptz,
  custom_css text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.registration_form_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view form config" ON public.registration_form_config
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins manage form config" ON public.registration_form_config
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Insert default config row
INSERT INTO public.registration_form_config (page_title, page_subtitle) VALUES ('Register', 'Join our community');

-- Table: registrations
CREATE TABLE public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose_id uuid REFERENCES public.registration_purposes(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  mobile text NOT NULL,
  blood_group text,
  university text,
  batch text,
  business_name text,
  job_area text,
  experience_years integer,
  photo_url text,
  extra_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Public can insert (no auth required)
CREATE POLICY "Anyone can submit registration" ON public.registrations
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Admins can view/update/delete
CREATE POLICY "Admins manage registrations" ON public.registrations
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Anon can also read purposes for the form
CREATE POLICY "Anon can view active purposes" ON public.registration_purposes
  FOR SELECT TO anon USING (is_active = true);

-- Anon can read form config
CREATE POLICY "Anon can view form config" ON public.registration_form_config
  FOR SELECT TO anon USING (true);

-- Allow anon to read distinct universities for auto-suggest
CREATE POLICY "Anon can read registrations for suggestions" ON public.registrations
  FOR SELECT TO anon USING (true);
