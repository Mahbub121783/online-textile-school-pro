-- Enable citext for case-insensitive unique usernames
CREATE EXTENSION IF NOT EXISTS citext;

-- 1. Add new columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS username citext,
  ADD COLUMN IF NOT EXISTS name_last_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS campus text,
  ADD COLUMN IF NOT EXISTS upazila text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS nid_number text,
  ADD COLUMN IF NOT EXISTS emergency_contact text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS github_url text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

-- 2. Unique index + format check on username
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_unique
  ON public.user_profiles (username)
  WHERE username IS NOT NULL;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_username_format;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_username_format
  CHECK (username IS NULL OR (length(username) BETWEEN 3 AND 30 AND username ~ '^[a-z0-9_]+$'));

-- 3. Name-change cooldown trigger (30 days)
CREATE OR REPLACE FUNCTION public.enforce_name_change_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    IF OLD.name_last_changed_at IS NOT NULL
       AND OLD.name_last_changed_at > (now() - interval '30 days') THEN
      RAISE EXCEPTION 'Name can only be changed once every 30 days. Next change available on %',
        to_char(OLD.name_last_changed_at + interval '30 days', 'YYYY-MM-DD');
    END IF;
    NEW.name_last_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_name_change_cooldown ON public.user_profiles;
CREATE TRIGGER trg_enforce_name_change_cooldown
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_name_change_cooldown();

-- 4. Update handle_new_user to capture username from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_roll_id TEXT;
  ref_code TEXT;
  referrer_id UUID;
  meta_username TEXT;
BEGIN
  new_roll_id := 'OTS-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
  ref_code := NEW.raw_user_meta_data->>'ref';
  meta_username := NULLIF(lower(trim(NEW.raw_user_meta_data->>'username')), '');

  IF ref_code IS NOT NULL AND ref_code != '' THEN
    SELECT id INTO referrer_id FROM public.user_profiles WHERE referral_code = ref_code LIMIT 1;
  END IF;

  INSERT INTO public.user_profiles (id, full_name, avatar_url, referral_code, roll_id, referred_by, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'REF-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0'),
    new_roll_id,
    referrer_id,
    meta_username
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0);

  IF referrer_id IS NOT NULL THEN
    INSERT INTO public.referral_rewards (referrer_id, referred_id, status)
    VALUES (referrer_id, NEW.id, 'pending');
  END IF;

  RETURN NEW;
END;
$$;