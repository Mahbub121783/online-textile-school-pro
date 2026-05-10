ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS department text;
UPDATE public.user_profiles SET department = campus WHERE department IS NULL AND campus IS NOT NULL;