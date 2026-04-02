-- Chat requests table for consent-based messaging
CREATE TABLE IF NOT EXISTS public.chat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

ALTER TABLE public.chat_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own requests" ON public.chat_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users send requests" ON public.chat_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users update requests" ON public.chat_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- Add soft delete and reactions to chat_messages
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reactions jsonb DEFAULT '{}'::jsonb;

-- Allow users to update own messages for soft delete and reactions
CREATE POLICY "Users update own messages" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);