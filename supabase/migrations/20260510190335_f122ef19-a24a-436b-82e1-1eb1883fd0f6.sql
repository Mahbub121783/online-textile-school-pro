-- Remove any duplicate workshop certs (keep earliest) before adding the unique index
DELETE FROM public.certificates a
USING public.certificates b
WHERE a.workshop_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.workshop_id = b.workshop_id
  AND a.ctid > b.ctid;

-- Partial unique index so workshop certs are unique per user, but course certs (workshop_id NULL) are unaffected
CREATE UNIQUE INDEX IF NOT EXISTS certificates_user_workshop_unique
  ON public.certificates (user_id, workshop_id)
  WHERE workshop_id IS NOT NULL;