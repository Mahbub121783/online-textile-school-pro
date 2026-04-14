
ALTER TABLE public.institutional_email_requests
  ADD COLUMN IF NOT EXISTS valid_from timestamptz,
  ADD COLUMN IF NOT EXISTS valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_password_reset_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_password text,
  ADD COLUMN IF NOT EXISTS email_quota_mb integer NOT NULL DEFAULT 512,
  ADD COLUMN IF NOT EXISTS disk_usage_bytes bigint DEFAULT 0;
