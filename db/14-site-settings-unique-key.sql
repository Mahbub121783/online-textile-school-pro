-- site_settings.key was never given a UNIQUE constraint despite being a
-- key/value store, so a re-run of any INSERT (no conflict target possible)
-- silently created duplicate rows per key instead of erroring or upserting.
-- Dedupe (keep lowest id per key) and add the constraint so this can't
-- recur, and so future ON CONFLICT (key) upserts from the admin UI work.
BEGIN;
ALTER TABLE public.site_settings NO FORCE ROW LEVEL SECURITY;

DELETE FROM public.site_settings a USING public.site_settings b
  WHERE a.id > b.id AND a.key = b.key;

ALTER TABLE public.site_settings FORCE ROW LEVEL SECURITY;
COMMIT;

ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_key_key UNIQUE (key);
