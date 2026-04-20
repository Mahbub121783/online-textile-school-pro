ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS whatsapp_number text;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS nid_number;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS emergency_contact;