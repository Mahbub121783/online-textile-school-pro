-- Add review_count to courses
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;

-- Trigger function to recalculate avg_rating and review_count from reviews table
CREATE OR REPLACE FUNCTION public.update_course_review_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _course_id := OLD.course_id;
  ELSE
    _course_id := NEW.course_id;
  END IF;

  UPDATE courses SET
    avg_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE course_id = _course_id AND is_approved = true), 0),
    review_count = COALESCE((SELECT COUNT(*)::integer FROM reviews WHERE course_id = _course_id AND is_approved = true), 0)
  WHERE id = _course_id;

  RETURN NULL;
END;
$$;

-- Trigger on reviews
DROP TRIGGER IF EXISTS trg_update_course_review_stats ON public.reviews;
CREATE TRIGGER trg_update_course_review_stats
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_course_review_stats();

-- Virtual lab completions table
CREATE TABLE IF NOT EXISTS public.virtual_lab_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lab_id uuid NOT NULL REFERENCES public.virtual_labs(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lab_id)
);

ALTER TABLE public.virtual_lab_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lab completions"
ON public.virtual_lab_completions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lab completions"
ON public.virtual_lab_completions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lab completions"
ON public.virtual_lab_completions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);