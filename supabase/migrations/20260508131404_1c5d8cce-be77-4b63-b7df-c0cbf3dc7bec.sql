-- Add link_token + locked_at to password_reset_codes
ALTER TABLE public.password_reset_codes
  ADD COLUMN IF NOT EXISTS link_token text,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_codes_link_token
  ON public.password_reset_codes (link_token)
  WHERE link_token IS NOT NULL;

-- Reliable case-insensitive lookup in auth.users (security definer bypasses normal restrictions)
CREATE OR REPLACE FUNCTION public.find_auth_user_by_email(_email text)
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      ''
    ) AS full_name
  FROM auth.users u
  WHERE lower(u.email) = lower(_email)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_auth_user_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_auth_user_by_email(text) TO service_role;