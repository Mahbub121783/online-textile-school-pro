DROP INDEX IF EXISTS public.certificates_user_workshop_unique;
ALTER TABLE public.certificates
  DROP CONSTRAINT IF EXISTS certificates_user_workshop_unique;
ALTER TABLE public.certificates
  ADD CONSTRAINT certificates_user_workshop_unique UNIQUE (user_id, workshop_id);