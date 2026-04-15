
-- 1. Storage UPDATE policy for media bucket
CREATE POLICY "Authenticated users can update media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'media')
WITH CHECK (bucket_id = 'media');

-- 2. Update handle_new_user trigger to process referrals
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_roll_id TEXT;
  ref_code TEXT;
  referrer_id UUID;
BEGIN
  new_roll_id := 'OTS-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
  ref_code := NEW.raw_user_meta_data->>'ref';

  -- Look up referrer
  IF ref_code IS NOT NULL AND ref_code != '' THEN
    SELECT id INTO referrer_id FROM public.user_profiles WHERE referral_code = ref_code LIMIT 1;
  END IF;

  INSERT INTO public.user_profiles (id, full_name, avatar_url, referral_code, roll_id, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'REF-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0'),
    new_roll_id,
    referrer_id
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');

  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0);

  -- Create pending referral reward if referrer found
  IF referrer_id IS NOT NULL THEN
    INSERT INTO public.referral_rewards (referrer_id, referred_id, status)
    VALUES (referrer_id, NEW.id, 'pending');
  END IF;

  RETURN NEW;
END;
$$;
