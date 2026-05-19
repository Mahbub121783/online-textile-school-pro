CREATE OR REPLACE FUNCTION public.qb_credit_paid_tokens_admin(_user_id uuid, _credits integer, _order_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL OR _credits IS NULL OR _credits <= 0 THEN RETURN; END IF;
  INSERT INTO public.qb_user_tokens(user_id, daily_balance, paid_balance, last_refill_date)
  VALUES (_user_id, 20, _credits, CURRENT_DATE)
  ON CONFLICT (user_id) DO UPDATE SET paid_balance = public.qb_user_tokens.paid_balance + _credits, updated_at = now();
  INSERT INTO public.qb_token_ledger(user_id, delta, reason, ref_id)
  VALUES (_user_id, _credits, 'purchase', _order_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.qb_credit_paid_tokens_admin(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qb_credit_paid_tokens_admin(uuid, integer, text) TO service_role;