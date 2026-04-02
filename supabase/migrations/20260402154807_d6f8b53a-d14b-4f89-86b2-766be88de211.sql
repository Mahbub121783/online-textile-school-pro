
-- Success Stories
CREATE TABLE public.success_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  photo_url text,
  story text NOT NULL,
  course_title text,
  graduation_year integer,
  job_title text,
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.success_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view stories" ON public.success_stories FOR SELECT USING (true);
CREATE POLICY "Admins manage stories" ON public.success_stories FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- User Badges
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_type text NOT NULL,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_type)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view badges" ON public.user_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "System inserts badges" ON public.user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Chat Messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own messages" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users send messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users mark read" ON public.chat_messages FOR UPDATE TO authenticated USING (auth.uid() = receiver_id);

-- Course prerequisites column
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS prerequisite_course_ids uuid[] DEFAULT '{}';
