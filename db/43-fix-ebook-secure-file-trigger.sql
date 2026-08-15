-- db/29's tg_ebooks_extract_file_url() ran BEFORE INSERT OR UPDATE and tried
-- to INSERT into ebook_secure_files(ebook_id=NEW.id, ...) -- but a BEFORE
-- trigger fires before the ebooks row itself is written, so the immediate
-- FK check (ebook_secure_files_ebook_id_fkey -> ebooks.id) always failed
-- with "Key is not present in table ebooks". This broke EVERY ebook
-- create/update that included a file_url, unconditionally, for every role
-- -- discovered while live-testing the instructor ebook upload flow
-- (reported as "ebook library not working" despite instructor access
-- already existing, which was correct -- role was never the blocker).
--
-- Fix: move the extraction to AFTER INSERT OR UPDATE (the ebooks row is
-- now committed within the same transaction, so the FK resolves), then
-- null out ebooks.file_url via a follow-up UPDATE instead of mutating NEW
-- (AFTER triggers can't do that). The IF NEW.file_url IS NOT NULL guard
-- prevents that follow-up UPDATE's own re-fired trigger from recursing.
CREATE OR REPLACE FUNCTION public.tg_ebooks_extract_file_url()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _prev_role text;
BEGIN
  IF NEW.file_url IS NOT NULL AND NEW.file_url <> '' THEN
    _prev_role := current_setting('request.jwt.claim.role', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    INSERT INTO public.ebook_secure_files (ebook_id, file_url, updated_at)
    VALUES (NEW.id, NEW.file_url, now())
    ON CONFLICT (ebook_id) DO UPDATE SET file_url = EXCLUDED.file_url, updated_at = now();
    UPDATE public.ebooks SET file_url = NULL WHERE id = NEW.id AND file_url IS NOT NULL;
    PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ebooks_extract_file_url ON public.ebooks;
CREATE TRIGGER trg_ebooks_extract_file_url
AFTER INSERT OR UPDATE ON public.ebooks
FOR EACH ROW EXECUTE FUNCTION public.tg_ebooks_extract_file_url();
