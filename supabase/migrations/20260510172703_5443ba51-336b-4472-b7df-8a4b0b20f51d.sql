-- Self-claim wrapper for workshop certificates
CREATE OR REPLACE FUNCTION public.claim_my_workshop_certificate(_workshop_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  RETURN public.issue_workshop_certificate(_workshop_id, auth.uid());
END;
$$;

-- Attach the auto-issue trigger (function already exists)
DROP TRIGGER IF EXISTS auto_issue_workshop_certs_trigger ON public.workshops;
CREATE TRIGGER auto_issue_workshop_certs_trigger
  AFTER UPDATE ON public.workshops
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_workshop_auto_issue_certs();