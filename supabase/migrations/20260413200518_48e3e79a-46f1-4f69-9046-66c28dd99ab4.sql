-- AI Chatbot Configuration table
CREATE TABLE public.ai_chatbot_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'lovable',
  api_key TEXT,
  model_name TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  system_prompt TEXT NOT NULL DEFAULT 'You are an AI Tutor for the Online Textile University.',
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_tokens INTEGER NOT NULL DEFAULT 2048,
  temperature NUMERIC NOT NULL DEFAULT 0.7,
  knowledge_base JSONB NOT NULL DEFAULT '[]'::jsonb,
  db_context_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_chatbot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage AI config" ON public.ai_chatbot_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_ai_chatbot_config_updated_at
  BEFORE UPDATE ON public.ai_chatbot_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed default config
INSERT INTO public.ai_chatbot_config (provider, model_name, system_prompt, knowledge_base)
VALUES (
  'lovable',
  'google/gemini-3-flash-preview',
  'You are an expert AI Tutor for the Online Textile University. You specialize in textile engineering, fiber science, weaving technology, knitting technology, dyeing & finishing, fabric structure, textile testing & quality control, yarn manufacturing, textile chemistry, and garment technology. You help students understand concepts, prepare for exams, solve assignments, and provide study guidance. Be encouraging, patient, and thorough. Use markdown formatting for better readability. When explaining technical concepts, break them into clear steps with examples.',
  '[
    {"topic": "Fiber Science", "content": "Natural fibers (cotton, wool, silk, jute, flax) and synthetic fibers (polyester, nylon, acrylic, spandex). Properties include tenacity, elongation, moisture regain, and thermal behavior."},
    {"topic": "Yarn Manufacturing", "content": "Spinning systems: ring spinning, rotor spinning, air-jet spinning. Yarn count systems: Ne (English), Nm (metric), Tex, Denier. Twist per inch (TPI) and its effect on yarn strength."},
    {"topic": "Weaving Technology", "content": "Primary motions: shedding, picking, beating. Secondary motions: let-off, take-up. Loom types: shuttle, projectile, rapier, air-jet, water-jet. Fabric structures: plain, twill, satin."},
    {"topic": "Knitting Technology", "content": "Warp knitting vs weft knitting. Basic stitches: knit, tuck, miss/float. Machine gauge, course, and wale. Circular vs flat knitting machines."},
    {"topic": "Dyeing & Finishing", "content": "Dyeing methods: exhaust dyeing, continuous dyeing, printing. Dye classes: reactive, disperse, acid, basic, vat, direct. Finishing: mechanical (calendering, sanforizing) and chemical (water repellent, flame retardant)."},
    {"topic": "Textile Testing", "content": "Tensile strength (strip/grab methods), tear strength (Elmendorf), abrasion resistance (Martindale), pilling resistance, color fastness (washing, light, rubbing), dimensional stability."},
    {"topic": "Fabric Structure", "content": "Weave notation and drafting. Cover factor calculations. GSM (grams per square meter). Fabric count (EPI x PPI). Crimp percentage and its effect on fabric properties."},
    {"topic": "Textile Chemistry", "content": "Cellulose chemistry, protein fiber chemistry. Mercerization process. Bleaching agents (H2O2, NaOCl). Sizing and desizing. pH control in wet processing."},
    {"topic": "Garment Technology", "content": "Pattern making, marker planning, fabric spreading, cutting methods. Sewing machine types. Seam types (superimposed, lapped, bound, flat). Quality control in garment production. SAM (Standard Allowed Minutes)."}
  ]'::jsonb
);