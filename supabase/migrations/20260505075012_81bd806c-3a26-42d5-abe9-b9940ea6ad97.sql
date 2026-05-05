-- 1. Last login tracking
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 2. Helper: generate a unique username from a base string
CREATE OR REPLACE FUNCTION public.generate_unique_username(_base text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug text;
  candidate text;
  counter int := 0;
  exists_already boolean;
BEGIN
  base_slug := lower(coalesce(_base, ''));
  base_slug := regexp_replace(base_slug, '[^a-z0-9_]+', '_', 'g');
  base_slug := regexp_replace(base_slug, '_+', '_', 'g');
  base_slug := trim(both '_' from base_slug);
  IF base_slug IS NULL OR length(base_slug) < 3 THEN
    base_slug := 'user_' || substr(md5(random()::text), 1, 6);
  END IF;
  IF length(base_slug) > 24 THEN
    base_slug := substr(base_slug, 1, 24);
  END IF;
  candidate := base_slug;
  LOOP
    SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE username = candidate) INTO exists_already;
    IF NOT exists_already THEN RETURN candidate; END IF;
    counter := counter + 1;
    candidate := substr(base_slug, 1, 24) || counter::text;
    IF counter > 9999 THEN
      RETURN base_slug || '_' || substr(md5(random()::text), 1, 6);
    END IF;
  END LOOP;
END;
$$;

-- 3. Backfill usernames for existing users (skip the cooldown trigger by only setting username column)
DO $$
DECLARE
  r record;
  new_name text;
BEGIN
  FOR r IN
    SELECT id, full_name, roll_id
    FROM public.user_profiles
    WHERE username IS NULL OR length(trim(username::text)) = 0
  LOOP
    new_name := public.generate_unique_username(coalesce(nullif(r.full_name, ''), r.roll_id, 'user'));
    UPDATE public.user_profiles SET username = new_name WHERE id = r.id;
  END LOOP;
END;
$$;

-- 4. Update handle_new_user: always assign a username
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
  final_username TEXT;
  base_for_username TEXT;
BEGIN
  new_roll_id := 'OTS-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
  ref_code := NEW.raw_user_meta_data->>'ref';
  meta_username := NULLIF(lower(trim(NEW.raw_user_meta_data->>'username')), '');

  IF ref_code IS NOT NULL AND ref_code != '' THEN
    SELECT id INTO referrer_id FROM public.user_profiles WHERE referral_code = ref_code LIMIT 1;
  END IF;

  -- Always assign a username
  IF meta_username IS NOT NULL AND meta_username ~ '^[a-z0-9_]{3,30}$'
     AND NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE username = meta_username) THEN
    final_username := meta_username;
  ELSE
    base_for_username := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      split_part(NEW.email, '@', 1),
      new_roll_id
    );
    final_username := public.generate_unique_username(base_for_username);
  END IF;

  INSERT INTO public.user_profiles (id, full_name, avatar_url, referral_code, roll_id, referred_by, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'REF-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0'),
    new_roll_id,
    referrer_id,
    final_username
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

-- 5. Allow users to update their own last_login_at via the existing "Users can update own profile" policy
-- (no separate policy needed since we already permit auth.uid() = id updates).