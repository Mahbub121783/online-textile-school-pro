
-- Homepage stats cache table to avoid 4 count queries per anon visitor
CREATE TABLE IF NOT EXISTS public.homepage_stats (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  instructors INT NOT NULL DEFAULT 0,
  courses INT NOT NULL DEFAULT 0,
  students INT NOT NULL DEFAULT 0,
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 4.8,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT homepage_stats_singleton CHECK (id = true)
);

ALTER TABLE public.homepage_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read homepage stats" ON public.homepage_stats;
CREATE POLICY "Public read homepage stats" ON public.homepage_stats FOR SELECT USING (true);

INSERT INTO public.homepage_stats (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.refresh_homepage_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _instructors INT;
  _courses INT;
  _students INT;
  _avg NUMERIC(3,2);
BEGIN
  SELECT COUNT(*) INTO _instructors FROM public.user_roles WHERE role = 'instructor';
  SELECT COUNT(*) INTO _courses FROM public.courses WHERE is_published = true;
  SELECT COUNT(*) INTO _students FROM public.user_profiles;
  SELECT COALESCE(ROUND(AVG(avg_rating)::numeric, 2), 4.8) INTO _avg
    FROM public.courses WHERE is_published = true AND avg_rating > 0;

  UPDATE public.homepage_stats
     SET instructors = _instructors,
         courses = _courses,
         students = _students,
         avg_rating = _avg,
         updated_at = now()
   WHERE id = true;
END $$;

-- Seed once now
SELECT public.refresh_homepage_stats();

-- pg_cron unavailable on self-host; scheduling moved to a cPanel Cron Job (Phase 5).
-- Original: 'refresh-homepage-stats' every 6h -> public.refresh_homepage_stats()
