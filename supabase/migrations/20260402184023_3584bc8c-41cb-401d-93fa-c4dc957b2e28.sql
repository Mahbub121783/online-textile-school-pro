
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_roll_id TEXT;
BEGIN
  new_roll_id := 'OTS-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');

  INSERT INTO public.user_profiles (id, full_name, avatar_url, referral_code, roll_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'REF-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0'),
    new_roll_id
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');

  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0);

  RETURN NEW;
END;
$$;

UPDATE public.user_profiles
SET roll_id = 'OTS-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0')
WHERE roll_id IS NULL;
