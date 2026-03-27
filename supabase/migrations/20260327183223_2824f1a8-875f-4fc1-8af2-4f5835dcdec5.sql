DROP POLICY "Admins manage R2 accounts" ON public.cloudflare_r2_accounts;
CREATE POLICY "Admins manage R2 accounts"
  ON public.cloudflare_r2_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY "Service role manages RR state" ON public.r2_round_robin_state;
CREATE POLICY "Admins manage RR state"
  ON public.r2_round_robin_state FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));