-- CRITICAL, platform-wide bug: wallet payments were completely
-- non-functional, and any cross-user wallet credit (instructor revenue
-- share, referral rewards) silently failed whenever triggered from a
-- plain client-side .rpc() call instead of the backend's serviceQuery.
--
-- Same root cause as db/26 (view/like/comment counts, course ratings,
-- discussion upvotes): credit_wallet()/debit_wallet() are SECURITY DEFINER
-- functions that UPDATE public.wallets -- which only has a service_role
-- UPDATE policy, no owner branch. A student paying with their OWN wallet
-- balance (debit_wallet(_user_id = themselves, ...)) still runs under
-- their own 'authenticated' session, not service_role, so even debiting
-- your own wallet failed. credit_wallet() targeting an instructor's or
-- referrer's wallet (a genuinely different user) obviously fails the same
-- way. Confirmed by code inspection: Checkout.tsx's wallet-payment branch
-- calls `supabase.rpc('debit_wallet', ...)` directly from the browser, and
-- AdminOrders.tsx's manual-payment approval calls
-- `supabase.rpc('credit_wallet', ...)` the same way -- neither goes
-- through the backend's serviceQuery path, so neither ever had a working
-- role context for this table.
--
-- Fix: same transaction-local role elevation pattern as db/26.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

CREATE OR REPLACE FUNCTION public.credit_wallet(_user_id uuid, _amount numeric, _description text, _reference_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _wallet_id uuid;
  _prev_role text;
BEGIN
  _prev_role := current_setting('request.jwt.claim.role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  SELECT id INTO _wallet_id FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, 0) RETURNING id INTO _wallet_id;
  END IF;

  UPDATE public.wallets SET balance = balance + _amount, updated_at = now() WHERE id = _wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, amount, type, description, reference_id)
  VALUES (_wallet_id, _amount, 'credit', _description, _reference_id);

  PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.debit_wallet(_user_id uuid, _amount numeric, _description text, _reference_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _wallet_id uuid;
  _balance numeric;
  _prev_role text;
BEGIN
  _prev_role := current_setting('request.jwt.claim.role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  SELECT id, balance INTO _wallet_id, _balance FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet_id IS NULL OR _balance < _amount THEN
    PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
    RETURN false;
  END IF;

  UPDATE public.wallets SET balance = balance - _amount, updated_at = now() WHERE id = _wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, amount, type, description, reference_id)
  VALUES (_wallet_id, _amount, 'debit', _description, _reference_id);

  PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
  RETURN true;
END;
$function$;
