-- institutional_email_requests, edumail_messages, edumail_contacts had zero
-- service_role branches (unlike most other tables). The original Deno
-- functions (cpanel-email-provisioner, edumail-client, edumail-imap-sync)
-- always used the service-role Supabase admin client, which bypasses RLS
-- entirely -- so this migration gives our self-host the equivalent: a
-- FOR ALL service_role policy, letting serviceQuery() do the same app-layer
-- WHERE-clause filtering (by user_id/owner_id) the original code relied on,
-- without touching the existing user/admin-facing policies used by the
-- generic REST layer for direct frontend .from() calls.

DROP POLICY IF EXISTS "Service role manages institutional email" ON public.institutional_email_requests;
CREATE POLICY "Service role manages institutional email" ON public.institutional_email_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages edumail messages" ON public.edumail_messages;
CREATE POLICY "Service role manages edumail messages" ON public.edumail_messages
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages edumail contacts" ON public.edumail_contacts;
CREATE POLICY "Service role manages edumail contacts" ON public.edumail_contacts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
