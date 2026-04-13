
-- wishlists
CREATE TABLE public.wishlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, course_id)
);
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own wishlists" ON public.wishlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users add own wishlists" ON public.wishlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own wishlists" ON public.wishlists FOR DELETE USING (auth.uid() = user_id);

-- learning_paths
CREATE TABLE public.learning_paths (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  thumbnail_url TEXT,
  price NUMERIC DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  course_ids UUID[] DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view published learning paths" ON public.learning_paths FOR SELECT USING (is_published = true OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins manage learning paths" ON public.learning_paths FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- learning_path_courses
CREATE TABLE public.learning_path_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  learning_path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0
);
ALTER TABLE public.learning_path_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view lpc" ON public.learning_path_courses FOR SELECT USING (true);
CREATE POLICY "Admins manage lpc" ON public.learning_path_courses FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- events
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  event_type TEXT DEFAULT 'general',
  image_url TEXT,
  link TEXT,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Admins manage events" ON public.events FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));
