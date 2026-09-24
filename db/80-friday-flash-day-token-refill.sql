-- Friday "Flash Day" bonus: the daily free practice-credit refill is 20
-- every day, except Friday (the weekly holiday in Bangladesh -- this site's
-- primary audience -- where traffic is noticeably higher), which refills to
-- 50 instead. Redefines qb_get_token_status()
-- (exact current body from db/58) with the refill amount now Friday-aware,
-- and returns `is_flash_day` in the response so the frontend can surface it.
--
-- "Friday" is computed in Asia/Dhaka local time (not the DB server's own
-- timezone) since the whole point is to match this audience's actual
-- Friday, and last_refill_date is compared/stored using that same local
-- date so the once-a-day refill boundary lines up with Dhaka midnight
-- rather than wherever the server happens to be.

SELECT set_config('request.jwt.claim.role', 'service_role', false);

CREATE OR REPLACE FUNCTION public.qb_get_token_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.qb_user_tokens%ROWTYPE;
  _today date := (now() AT TIME ZONE 'Asia/Dhaka')::date;
  _is_flash_day boolean := EXTRACT(DOW FROM _today) = 5; -- 5 = Friday
  _refill_amount int := CASE WHEN EXTRACT(DOW FROM _today) = 5 THEN 50 ELSE 20 END;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  INSERT INTO public.qb_user_tokens(user_id, daily_balance, paid_balance, last_refill_date)
  VALUES (_uid, _refill_amount, 0, _today)
  ON CONFLICT (user_id) DO UPDATE SET
    daily_balance = CASE WHEN public.qb_user_tokens.last_refill_date < _today THEN _refill_amount ELSE public.qb_user_tokens.daily_balance END,
    last_refill_date = CASE WHEN public.qb_user_tokens.last_refill_date < _today THEN _today ELSE public.qb_user_tokens.last_refill_date END,
    updated_at = now()
  RETURNING * INTO _row;
  RETURN jsonb_build_object(
    'daily_balance', _row.daily_balance,
    'paid_balance', _row.paid_balance,
    'last_refill_date', _row.last_refill_date,
    'is_flash_day', _is_flash_day,
    'is_staff', public.qb_is_staff(_uid)
  );
END $$;

-- No GRANT needed here -- this self-hosted DB has no real "authenticated"
-- Postgres role (see project memory), and the function owner
-- (tecnedub_ots_app) can already execute its own functions.
