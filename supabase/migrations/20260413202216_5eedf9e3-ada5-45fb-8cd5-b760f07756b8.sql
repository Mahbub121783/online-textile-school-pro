
-- Table: ai_api_keys - rolling API key pool
CREATE TABLE public.ai_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'groq',
  api_key text NOT NULL,
  label text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  last_error text,
  error_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai_api_keys"
  ON public.ai_api_keys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Table: ai_chat_history - per-message history
CREATE TABLE public.ai_chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL DEFAULT '',
  provider_used text,
  model_used text,
  tokens_used integer,
  response_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_chat_history_user ON public.ai_chat_history(user_id);
CREATE INDEX idx_ai_chat_history_session ON public.ai_chat_history(session_id);
CREATE INDEX idx_ai_chat_history_created ON public.ai_chat_history(created_at DESC);

ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat history"
  ON public.ai_chat_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own chat history"
  ON public.ai_chat_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all chat history"
  ON public.ai_chat_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Table: ai_search_index - full-text search index
CREATE TABLE public.ai_search_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  content_summary text NOT NULL DEFAULT '',
  keywords text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  search_vector tsvector,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX idx_ai_search_vector ON public.ai_search_index USING GIN(search_vector);
CREATE INDEX idx_ai_search_keywords ON public.ai_search_index USING GIN(keywords);
CREATE INDEX idx_ai_search_entity_type ON public.ai_search_index(entity_type);

-- Auto-generate tsvector on insert/update
CREATE OR REPLACE FUNCTION public.ai_search_index_vector_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.content_summary, '') || ' ' ||
    coalesce(array_to_string(NEW.keywords, ' '), '')
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_search_index_vector
  BEFORE INSERT OR UPDATE ON public.ai_search_index
  FOR EACH ROW EXECUTE FUNCTION public.ai_search_index_vector_trigger();

ALTER TABLE public.ai_search_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read search index"
  ON public.ai_search_index FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage search index"
  ON public.ai_search_index FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Also allow service_role (edge functions) to manage search index
CREATE POLICY "Service role can manage search index"
  ON public.ai_search_index FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service_role to manage ai_api_keys (for usage tracking)
CREATE POLICY "Service role can manage ai_api_keys"
  ON public.ai_api_keys FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service_role to manage ai_chat_history
CREATE POLICY "Service role can manage ai_chat_history"
  ON public.ai_chat_history FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
