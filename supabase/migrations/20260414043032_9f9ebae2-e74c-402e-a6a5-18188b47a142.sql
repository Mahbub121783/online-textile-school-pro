CREATE OR REPLACE FUNCTION public.cleanup_old_ai_chats()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.ai_chat_history WHERE created_at < now() - interval '3 days';
  DELETE FROM public.ai_chat_sessions WHERE updated_at < now() - interval '3 days';
$$;