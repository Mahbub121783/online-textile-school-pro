-- ============================================================
-- notify_admins(_type, _title, _message, _link): called by several edge
-- functions (ai-tutor on key auto-disable, cpanel-email-provisioner on
-- provisioning) but never actually CREATEd anywhere -- only appears in a
-- later migration's REVOKE EXECUTE list, confirming it's the same
-- "pre-history" gap class as credit_wallet/debit_wallet/has_role. Signature
-- confirmed from that REVOKE statement: notify_admins(text, text, text, text).
-- Reconstructed from call-site usage: inserts one notifications row per
-- admin/super_admin user.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_admins(_type text, _title text, _message text, _link text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT ur.user_id, _type, _title, _message, _link
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'super_admin');
END;
$$;

-- No REVOKE here: anon/authenticated aren't real Postgres roles on this
-- self-host (single connecting role, tecnedub_ots_app -- see
-- db/01-auth-shim.sql). Public access is already blocked at the app layer
-- via RPC_BLOCKLIST in backend/src/rest.js.
