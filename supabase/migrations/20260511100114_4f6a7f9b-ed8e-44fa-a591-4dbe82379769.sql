
CREATE TABLE IF NOT EXISTS public.qb_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'groq',
  model text NOT NULL DEFAULT 'llama-3.3-70b-versatile',
  temperature numeric NOT NULL DEFAULT 0.7,
  max_questions_per_run int NOT NULL DEFAULT 25,
  fallback_enabled boolean NOT NULL DEFAULT true,
  fallback_provider text NOT NULL DEFAULT 'lovable',
  fallback_model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  system_prompt_override text,
  singleton boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qb_ai_settings_singleton_unique UNIQUE (singleton)
);

ALTER TABLE public.qb_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read qb_ai_settings"
  ON public.qb_ai_settings FOR SELECT
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins insert qb_ai_settings"
  ON public.qb_ai_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins update qb_ai_settings"
  ON public.qb_ai_settings FOR UPDATE
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_qb_ai_settings_updated
  BEFORE UPDATE ON public.qb_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.qb_ai_settings (provider, model)
VALUES ('groq', 'llama-3.3-70b-versatile')
ON CONFLICT DO NOTHING;
