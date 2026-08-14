-- ai-tutor reads the active config via serviceQuery (service_role context)
-- on every chat request -- only "Admins manage" (authenticated+admin)
-- policies existed, unlike ai_api_keys/ai_chat_history/ai_search_index
-- which all already had a service_role ALL policy alongside the admin one.
CREATE POLICY "Service role can manage ai_chatbot_config" ON public.ai_chatbot_config
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
