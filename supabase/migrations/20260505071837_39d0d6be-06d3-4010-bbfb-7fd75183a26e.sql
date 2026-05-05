-- Add session_key column for anonymous view dedup
ALTER TABLE public.class_video_views
  ADD COLUMN IF NOT EXISTS session_key text;

-- Dedup logged-in views: one row per (video_id, user_id)
CREATE UNIQUE INDEX IF NOT EXISTS class_video_views_user_unique
  ON public.class_video_views (video_id, user_id)
  WHERE user_id IS NOT NULL;

-- Dedup anonymous views: one row per (video_id, session_key)
CREATE UNIQUE INDEX IF NOT EXISTS class_video_views_anon_unique
  ON public.class_video_views (video_id, session_key)
  WHERE user_id IS NULL AND session_key IS NOT NULL;