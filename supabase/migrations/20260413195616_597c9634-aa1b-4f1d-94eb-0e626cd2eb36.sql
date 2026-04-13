-- AI Chat Sessions table
CREATE TABLE public.ai_chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New Chat',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own chat sessions" ON public.ai_chat_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all chat sessions" ON public.ai_chat_sessions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_ai_chat_sessions_updated_at
  BEFORE UPDATE ON public.ai_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_ai_chat_sessions_user ON public.ai_chat_sessions(user_id);
CREATE INDEX idx_ai_chat_sessions_course ON public.ai_chat_sessions(course_id);