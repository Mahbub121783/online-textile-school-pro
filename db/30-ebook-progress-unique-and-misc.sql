-- ebook_reading_progress had no unique constraint on (user_id, ebook_id),
-- so the reader's upsert({...}, {onConflict:'user_id,ebook_id'}) call
-- (EbookReader.tsx) has been failing with "no unique or exclusion
-- constraint matching the ON CONFLICT specification" on every save after
-- the first page load -- silently, since the call site never checked the
-- error. Same bug class already fixed for class_video_views (db/25) but
-- missed here. "Resume where you left off" has effectively never worked.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ebook_reading_progress_user_ebook
  ON public.ebook_reading_progress (user_id, ebook_id);
