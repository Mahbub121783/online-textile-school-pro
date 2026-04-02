
-- Forum Categories
CREATE TABLE public.forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view forum categories" ON public.forum_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage forum categories" ON public.forum_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Forum Posts
CREATE TABLE public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid REFERENCES public.forum_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  is_closed boolean DEFAULT false,
  view_count integer DEFAULT 0,
  search_vector tsvector,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_forum_posts_search ON public.forum_posts USING GIN (search_vector);
CREATE INDEX idx_forum_posts_category ON public.forum_posts(category_id);
CREATE INDEX idx_forum_posts_user ON public.forum_posts(user_id);

CREATE OR REPLACE FUNCTION public.forum_posts_search_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.content, ''));
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_forum_posts_search BEFORE INSERT OR UPDATE OF title, content ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.forum_posts_search_trigger();

CREATE POLICY "Anyone can view forum posts" ON public.forum_posts FOR SELECT USING (true);
CREATE POLICY "Auth users create forum posts" ON public.forum_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner or admin update forum posts" ON public.forum_posts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Admin delete forum posts" ON public.forum_posts FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Forum Comments
CREATE TABLE public.forum_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.forum_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_forum_comments_post ON public.forum_comments(post_id);
CREATE POLICY "Anyone can view forum comments" ON public.forum_comments FOR SELECT USING (true);
CREATE POLICY "Auth users create forum comments" ON public.forum_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner or admin delete forum comments" ON public.forum_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Forum Reactions
CREATE TABLE public.forum_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id uuid NOT NULL,
  emoji text DEFAULT '❤️',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, target_type, target_id, emoji)
);
ALTER TABLE public.forum_reactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_forum_reactions_target ON public.forum_reactions(target_type, target_id);
CREATE POLICY "Anyone can view forum reactions" ON public.forum_reactions FOR SELECT USING (true);
CREATE POLICY "Auth users toggle reactions" ON public.forum_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reactions" ON public.forum_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Forum Contributor Points
CREATE TABLE public.forum_contributor_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  reference_id uuid,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.forum_contributor_points ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_forum_points_user ON public.forum_contributor_points(user_id);
CREATE POLICY "Users view own points" ON public.forum_contributor_points FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "System inserts points" ON public.forum_contributor_points FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Forum Rewards (admin-granted)
CREATE TABLE public.forum_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  points integer NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.forum_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own rewards" ON public.forum_rewards FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Admins grant rewards" ON public.forum_rewards FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Search function
CREATE OR REPLACE FUNCTION public.search_forum(search_query text)
RETURNS SETOF public.forum_posts
LANGUAGE sql STABLE
AS $$
  SELECT * FROM public.forum_posts
  WHERE search_vector @@ plainto_tsquery('english', search_query)
  ORDER BY ts_rank(search_vector, plainto_tsquery('english', search_query)) DESC, created_at DESC
  LIMIT 50;
$$;
