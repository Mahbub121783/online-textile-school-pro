ALTER TABLE public.institutional_email_requests
ADD COLUMN IF NOT EXISTS last_synced_uid integer DEFAULT 0;