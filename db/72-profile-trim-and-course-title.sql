SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- Completes steps 3+4 of db/71, which aborted partway: the bulk trim there
-- touched full_name, which trips the pre-existing trg_enforce_name_change_cooldown
-- ("Name can only be changed once every 30 days"). Whitespace normalisation is
-- not a real name change, so full_name is handled separately with that guard
-- temporarily lifted, and the ongoing trim trigger deliberately leaves
-- full_name alone so it can never interfere with the 30-day rule.

BEGIN;

-- department/campus: no cooldown guard, safe to trim directly.
UPDATE public.user_profiles
   SET department = NULLIF(btrim(department), ''),
       campus     = NULLIF(btrim(campus), '')
 WHERE department IS DISTINCT FROM NULLIF(btrim(department), '')
    OR campus     IS DISTINCT FROM NULLIF(btrim(campus), '');

-- full_name: whitespace-only cleanup, cooldown guard lifted for the duration.
ALTER TABLE public.user_profiles DISABLE TRIGGER trg_enforce_name_change_cooldown;

UPDATE public.user_profiles
   SET full_name = NULLIF(btrim(full_name), '')
 WHERE full_name IS DISTINCT FROM NULLIF(btrim(full_name), '');

ALTER TABLE public.user_profiles ENABLE TRIGGER trg_enforce_name_change_cooldown;

-- Keep department/campus trimmed on every future write. full_name is
-- intentionally excluded -- see header.
CREATE OR REPLACE FUNCTION public.trg_trim_user_profile_text()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.department := NULLIF(btrim(NEW.department), '');
  NEW.campus     := NULLIF(btrim(NEW.campus), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_trim_text ON public.user_profiles;
CREATE TRIGGER user_profiles_trim_text
BEFORE INSERT OR UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_trim_user_profile_text();

-- Course title typo -- appears on every enrollment verification letter.
UPDATE public.courses
   SET title = 'The Textile Engineers Internship Accelerator'
 WHERE title = 'The Textile Engineers Internship Accelerato';

COMMIT;
