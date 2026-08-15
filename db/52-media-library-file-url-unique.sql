-- media_library.file_url has no unique constraint, but MediaUploader.tsx,
-- MediaPickerModal.tsx, AdminMedia.tsx and SettingsPage.tsx all do
-- .upsert(..., { onConflict: 'file_url' }) against it. Postgres rejects
-- ON CONFLICT (file_url) without a matching unique index/constraint with
-- "no unique or exclusion constraint matching the ON CONFLICT specification"
-- -- confirmed live: media_library had 0 rows despite uploads having
-- happened, because every one of those upserts was silently failing
-- (the error was never surfaced client-side).
ALTER TABLE public.media_library
  ADD CONSTRAINT media_library_file_url_key UNIQUE (file_url);
