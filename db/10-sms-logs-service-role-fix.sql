-- send-sms writes to sms_logs via serviceQuery (service_role context) --
-- only "Admins manage" (authenticated+admin) and "Only admins can read"
-- policies existed, no service_role access at all. Matches the
-- "Service role full access" ALL pattern already used on email_logs.
CREATE POLICY "Service role full access to sms logs" ON public.sms_logs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
