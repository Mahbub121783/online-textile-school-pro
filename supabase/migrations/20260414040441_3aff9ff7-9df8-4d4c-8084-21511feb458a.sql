
-- Drop the existing broken policy
DROP POLICY IF EXISTS "Admins can manage ai_api_keys" ON public.ai_api_keys;

-- Recreate with super_admin support
CREATE POLICY "Admins can manage ai_api_keys"
ON public.ai_api_keys
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- Also fix ai_chatbot_config if it has the same issue
DROP POLICY IF EXISTS "Admins can manage ai_chatbot_config" ON public.ai_chatbot_config;
CREATE POLICY "Admins can manage ai_chatbot_config"
ON public.ai_chatbot_config
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- Fix ai_chat_history policies too
DROP POLICY IF EXISTS "Admins can view all chat history" ON public.ai_chat_history;
CREATE POLICY "Admins can view all chat history"
ON public.ai_chat_history
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- Fix ai_search_index
DROP POLICY IF EXISTS "Admins can manage search index" ON public.ai_search_index;
CREATE POLICY "Admins can manage search index"
ON public.ai_search_index
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- Allow all authenticated users to read search index (for AI queries)
DROP POLICY IF EXISTS "Anyone can read search index" ON public.ai_search_index;
CREATE POLICY "Anyone can read search index"
ON public.ai_search_index
FOR SELECT
TO authenticated
USING (true);
