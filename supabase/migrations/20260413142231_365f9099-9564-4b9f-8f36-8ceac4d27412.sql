
DROP POLICY "Service role full access" ON public.email_unsubscribes;

CREATE POLICY "Service role full access" ON public.email_unsubscribes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
