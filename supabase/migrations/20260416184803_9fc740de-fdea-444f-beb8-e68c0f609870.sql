ALTER TABLE public.popups
  ADD COLUMN IF NOT EXISTS background_video_url TEXT,
  ADD COLUMN IF NOT EXISTS background_video_overlay_opacity NUMERIC DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS countdown_source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS countdown_source_id UUID,
  ADD COLUMN IF NOT EXISTS countdown_source_field TEXT,
  ADD COLUMN IF NOT EXISTS countdown_expired_action TEXT DEFAULT 'hide',
  ADD COLUMN IF NOT EXISTS countdown_expired_message TEXT;