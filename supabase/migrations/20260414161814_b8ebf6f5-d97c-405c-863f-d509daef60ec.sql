-- Extend research_papers table
ALTER TABLE public.research_papers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doi text,
  ADD COLUMN IF NOT EXISTS volume text,
  ADD COLUMN IF NOT EXISTS issue text,
  ADD COLUMN IF NOT EXISTS page_range text,
  ADD COLUMN IF NOT EXISTS reviewer_id uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS reviewer_feedback text,
  ADD COLUMN IF NOT EXISTS revision_notes text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS citation_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Migrate existing data: approved papers -> status 'approved', others -> 'submitted'
UPDATE public.research_papers SET status = 'approved' WHERE is_approved = true;
UPDATE public.research_papers SET status = 'submitted' WHERE is_approved = false;

-- Create research_paper_reviews table
CREATE TABLE IF NOT EXISTS public.research_paper_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid REFERENCES public.research_papers(id) ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  rating integer CHECK (rating >= 1 AND rating <= 5),
  feedback text,
  is_anonymous boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.research_paper_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reviews"
  ON public.research_paper_reviews FOR SELECT TO authenticated USING (true);

CREATE POLICY "Reviewers can update their own reviews"
  ON public.research_paper_reviews FOR UPDATE TO authenticated
  USING (reviewer_id = auth.uid());

CREATE POLICY "Admins can manage reviews"
  ON public.research_paper_reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Create research_paper_access table
CREATE TABLE IF NOT EXISTS public.research_paper_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid REFERENCES public.research_papers(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  access_type text NOT NULL DEFAULT 'granted',
  created_at timestamptz DEFAULT now(),
  UNIQUE(paper_id, user_id)
);

ALTER TABLE public.research_paper_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own access"
  ON public.research_paper_access FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own access"
  ON public.research_paper_access FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage access"
  ON public.research_paper_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Create research_paper_bookmarks table
CREATE TABLE IF NOT EXISTS public.research_paper_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid REFERENCES public.research_papers(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(paper_id, user_id)
);

ALTER TABLE public.research_paper_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookmarks"
  ON public.research_paper_bookmarks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own bookmarks"
  ON public.research_paper_bookmarks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own bookmarks"
  ON public.research_paper_bookmarks FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage bookmarks"
  ON public.research_paper_bookmarks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Increment view count function
CREATE OR REPLACE FUNCTION public.increment_research_paper_view(_paper_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE research_papers SET view_count = COALESCE(view_count, 0) + 1 WHERE id = _paper_id;
$$;

-- Increment download count function
CREATE OR REPLACE FUNCTION public.increment_research_paper_download(_paper_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE research_papers SET download_count = COALESCE(download_count, 0) + 1 WHERE id = _paper_id;
$$;