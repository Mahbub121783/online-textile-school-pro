-- 1. Extend user_profiles with rich contributor fields
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS headline TEXT,
  ADD COLUMN IF NOT EXISTS expertise TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_public_contributor BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vote_count INTEGER NOT NULL DEFAULT 0;

-- 2. contributor_votes table
CREATE TABLE IF NOT EXISTS public.contributor_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL DEFAULT 'upvote',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contributor_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_contributor_votes_contributor ON public.contributor_votes(contributor_id);
CREATE INDEX IF NOT EXISTS idx_contributor_votes_voter ON public.contributor_votes(voter_id);

ALTER TABLE public.contributor_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read votes"
  ON public.contributor_votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can vote"
  ON public.contributor_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = voter_id AND auth.uid() <> contributor_id);

CREATE POLICY "Users can remove their own vote"
  ON public.contributor_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = voter_id);

-- 3. Trigger to keep vote_count in sync
CREATE OR REPLACE FUNCTION public.update_contributor_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_profiles SET vote_count = vote_count + 1 WHERE id = NEW.contributor_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_profiles SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.contributor_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_contributor_vote_count ON public.contributor_votes;
CREATE TRIGGER trg_contributor_vote_count
  AFTER INSERT OR DELETE ON public.contributor_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_contributor_vote_count();

-- 4. content_contributors unified join table
CREATE TABLE IF NOT EXISTS public.content_contributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('course', 'ebook', 'workshop')),
  content_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'co_author' CHECK (role IN ('lead_instructor','co_instructor','author','co_author','reviewer')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_type, content_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_content_contributors_content ON public.content_contributors(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_contributors_user ON public.content_contributors(user_id);

ALTER TABLE public.content_contributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read contributors"
  ON public.content_contributors FOR SELECT
  USING (true);

-- Admin / super_admin / lead instructor of the course can manage
CREATE OR REPLACE FUNCTION public.can_manage_content_contributors(_content_type TEXT, _content_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin BOOLEAN;
  _is_owner BOOLEAN := false;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
    INTO _is_admin;

  IF _is_admin THEN RETURN true; END IF;

  IF _content_type = 'course' THEN
    SELECT EXISTS(SELECT 1 FROM public.courses WHERE id = _content_id AND instructor_id = auth.uid())
      INTO _is_owner;
  ELSIF _content_type = 'workshop' THEN
    SELECT EXISTS(SELECT 1 FROM public.workshops WHERE id = _content_id AND instructor_id = auth.uid())
      INTO _is_owner;
  END IF;

  RETURN _is_owner;
END;
$$;

CREATE POLICY "Managers can insert contributors"
  ON public.content_contributors FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_content_contributors(content_type, content_id));

CREATE POLICY "Managers can update contributors"
  ON public.content_contributors FOR UPDATE
  TO authenticated
  USING (public.can_manage_content_contributors(content_type, content_id));

CREATE POLICY "Managers can delete contributors"
  ON public.content_contributors FOR DELETE
  TO authenticated
  USING (public.can_manage_content_contributors(content_type, content_id));