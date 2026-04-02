
CREATE TABLE public.student_id_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  card_number text NOT NULL UNIQUE,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.student_id_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own id card" ON public.student_id_cards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins manage id cards" ON public.student_id_cards
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TABLE public.id_card_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_name text NOT NULL DEFAULT 'Online Textile School',
  location text NOT NULL DEFAULT 'Dhaka, Bangladesh',
  authority_name text DEFAULT '',
  authority_position text DEFAULT '',
  signature_url text DEFAULT '',
  logo_url text DEFAULT '',
  card_bg_color text DEFAULT '#1a365d',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.id_card_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view id card settings" ON public.id_card_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage id card settings" ON public.id_card_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.id_card_settings (university_name, location) VALUES ('Online Textile School', 'Dhaka, Bangladesh');
