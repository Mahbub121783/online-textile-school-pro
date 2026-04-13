
-- 1. Enhance discussions table
ALTER TABLE public.discussions
  ADD COLUMN IF NOT EXISTS upvote_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false;

-- 2. Create discussion_upvotes table
CREATE TABLE public.discussion_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid NOT NULL REFERENCES public.discussions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(discussion_id, user_id)
);
ALTER TABLE public.discussion_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view upvotes"
  ON public.discussion_upvotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add their own upvotes"
  ON public.discussion_upvotes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own upvotes"
  ON public.discussion_upvotes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger to keep upvote_count in sync
CREATE OR REPLACE FUNCTION public.update_discussion_upvote_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE discussions SET upvote_count = upvote_count + 1 WHERE id = NEW.discussion_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE discussions SET upvote_count = upvote_count - 1 WHERE id = OLD.discussion_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_discussion_upvote_insert
  AFTER INSERT ON public.discussion_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.update_discussion_upvote_count();

CREATE TRIGGER trg_discussion_upvote_delete
  AFTER DELETE ON public.discussion_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.update_discussion_upvote_count();

-- 3. Enhance reviews table
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT null,
  ADD COLUMN IF NOT EXISTS admin_response text DEFAULT null;

-- 4. Create peer_reviews table
CREATE TABLE public.peer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.assignment_submissions(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  rubric_scores jsonb DEFAULT '{}',
  feedback text,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(submission_id, reviewer_id)
);
ALTER TABLE public.peer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access peer_reviews"
  ON public.peer_reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Reviewers can insert own peer reviews"
  ON public.peer_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Reviewers can update own peer reviews"
  ON public.peer_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = reviewer_id);
CREATE POLICY "Students can view reviews on their submissions"
  ON public.peer_reviews FOR SELECT TO authenticated
  USING (
    auth.uid() = reviewer_id
    OR EXISTS (
      SELECT 1 FROM public.assignment_submissions s WHERE s.id = submission_id AND s.user_id = auth.uid()
    )
  );

-- 5. Create peer_review_config table
CREATE TABLE public.peer_review_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE UNIQUE,
  min_reviewers integer NOT NULL DEFAULT 2,
  rubric_criteria jsonb DEFAULT '[]',
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.peer_review_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage peer_review_config"
  ON public.peer_review_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Authenticated can view peer_review_config"
  ON public.peer_review_config FOR SELECT TO authenticated USING (true);

-- Indexes
CREATE INDEX idx_discussion_upvotes_discussion ON public.discussion_upvotes(discussion_id);
CREATE INDEX idx_peer_reviews_submission ON public.peer_reviews(submission_id);
CREATE INDEX idx_peer_reviews_reviewer ON public.peer_reviews(reviewer_id);
CREATE INDEX idx_reviews_is_approved ON public.reviews(is_approved);
