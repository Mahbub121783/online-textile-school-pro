-- ebook_access_tokens had read/insert/update policies but no DELETE policy
-- at all (found while cleaning up a test token during the ebook flow test)
-- -- harmless in practice since tokens self-expire in 30 minutes, but admin
-- tooling had no way to revoke/clean one up early either.
DROP POLICY IF EXISTS "Service role deletes ebook access tokens" ON public.ebook_access_tokens;
CREATE POLICY "Service role deletes ebook access tokens" ON public.ebook_access_tokens
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );
