SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','f49d6153-1835-4455-81f3-2918d5d3484e',false);

-- `backend/src/functions/internalCron.js` has referenced a
-- 'workshop-auto-status' job calling this function since it was ported from
-- the original Supabase project, but the function itself was never actually
-- defined anywhere in db/*.sql -- a pre-history gap (same class as the other
-- "referenced by code, never captured in migrations" gaps documented in
-- db/92's header). Calling the cron job before this migration throws
-- "function does not exist". This defines it for real and wires up a live
-- cPanel cron entry to call it (see deploy notes).
CREATE OR REPLACE FUNCTION public.auto_update_workshop_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- workshops' RLS policy only allows 'authenticated' + admin/super_admin
  -- (no service_role bypass clause, unlike most tables -- same gotcha as
  -- site_settings) -- borrow a staff identity for this call so the UPDATEs
  -- below aren't silently no-op'd by RLS when invoked from the cron's
  -- service_role context.
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', 'f49d6153-1835-4455-81f3-2918d5d3484e', true);

  -- published/ongoing workshops whose end has passed -> completed.
  -- Checked before the ongoing transition below so a short workshop that
  -- both started and ended between cron runs goes straight to 'completed'
  -- (still firing tg_workshop_auto_issue_certs, which only fires on a
  -- transition INTO 'completed') instead of getting stuck "ongoing".
  UPDATE public.workshops
  SET status = 'completed'
  WHERE status IN ('published', 'ongoing')
    AND end_at IS NOT NULL
    AND end_at <= now();

  -- published workshops that have started but not yet ended -> ongoing
  UPDATE public.workshops
  SET status = 'ongoing'
  WHERE status = 'published'
    AND start_at IS NOT NULL
    AND start_at <= now()
    AND (end_at IS NULL OR end_at > now());
END;
$function$;
