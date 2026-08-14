-- ============================================================
-- credit_wallet / debit_wallet / increment_ebook_download: referenced by
-- edge functions (process-payment, ebook-secure-access) and the migration
-- REVOKE array, but never actually CREATEd anywhere -- also pre-history
-- bootstrap functions, reconstructed from call-site usage.
-- ============================================================

CREATE OR REPLACE FUNCTION public.credit_wallet(_user_id uuid, _amount numeric, _description text, _reference_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _wallet_id uuid;
BEGIN
  SELECT id INTO _wallet_id FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, 0) RETURNING id INTO _wallet_id;
  END IF;

  UPDATE public.wallets SET balance = balance + _amount, updated_at = now() WHERE id = _wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, amount, type, description, reference_id)
  VALUES (_wallet_id, _amount, 'credit', _description, _reference_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.debit_wallet(_user_id uuid, _amount numeric, _description text, _reference_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _wallet_id uuid;
  _balance numeric;
BEGIN
  SELECT id, balance INTO _wallet_id, _balance FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet_id IS NULL OR _balance < _amount THEN
    RETURN false;
  END IF;

  UPDATE public.wallets SET balance = balance - _amount, updated_at = now() WHERE id = _wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, amount, type, description, reference_id)
  VALUES (_wallet_id, _amount, 'debit', _description, _reference_id);

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_ebook_download(_ebook_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  -- ebooks table has no download-count column in the reconstructed bootstrap
  -- schema; this is a no-op placeholder so callers don't error. Add a real
  -- counter column + UPDATE here if/when that stat is actually needed.
  SELECT 1;
$$;
