-- Auto-links a user's free-text "university" field (src/pages/dashboard/
-- SettingsPage.tsx) to an onboarded campus by exact case-insensitive name
-- match, so the campus's live student count (CampusPortfolio.tsx counts
-- user_profiles.onboarded_campus_id) updates the moment someone sets/changes
-- their university -- not only when they separately visit that campus's
-- subdomain and click "I'm a student here". A DB trigger (not frontend
-- logic) so it covers every code path that writes user_profiles.university
-- (Settings, registration, admin edits) from one place.
CREATE OR REPLACE FUNCTION public.link_university_to_campus()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.university IS NOT DISTINCT FROM OLD.university THEN
    RETURN NEW;
  END IF;

  IF NEW.university IS NOT NULL AND length(trim(NEW.university)) > 0 THEN
    SELECT id INTO NEW.onboarded_campus_id
    FROM public.campus_onboard_requests
    WHERE status = 'approved' AND lower(trim(campus_name)) = lower(trim(NEW.university))
    LIMIT 1;
  ELSE
    NEW.onboarded_campus_id := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_link_university_to_campus ON public.user_profiles;
CREATE TRIGGER trg_link_university_to_campus
  BEFORE INSERT OR UPDATE OF university ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.link_university_to_campus();

-- Backfill: link existing profiles whose university text already matches an
-- approved campus name, so counts are correct retroactively too.
UPDATE public.user_profiles up
SET onboarded_campus_id = c.id
FROM public.campus_onboard_requests c
WHERE c.status = 'approved'
  AND up.university IS NOT NULL AND length(trim(up.university)) > 0
  AND lower(trim(up.university)) = lower(trim(c.campus_name))
  AND up.onboarded_campus_id IS DISTINCT FROM c.id;
