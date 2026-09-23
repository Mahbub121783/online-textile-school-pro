SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- Eligibility is unchanged from db/66 (still requires >=1 genuinely paid
-- enrollment -- an order that actually completed with total > 0). This
-- migration only changes the DURATION formula once a student qualifies:
--   - first paid course:        1.2 years  (14.4 months)
--   - each additional paid course: +6 months
--   - +6 months ONE TIME (not per-course) if the student also has any
--     free/non-qualifying enrollment on record
CREATE OR REPLACE FUNCTION public.enforce_student_id_card_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _privileged boolean;
  _paid_count integer;
  _free_count integer;
  _earliest timestamptz;
  _total_months numeric;
BEGIN
  _privileged := (current_setting('request.jwt.claim.role', true) = 'service_role')
    OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin');
  IF _privileged THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _paid_count
  FROM public.enrollments e
  JOIN public.orders o ON o.id = e.payment_id
  WHERE e.user_id = NEW.user_id AND o.status = 'completed' AND o.total > 0;

  IF _paid_count IS NULL OR _paid_count = 0 THEN
    RAISE EXCEPTION 'No paid enrollments -- cannot issue a student ID card' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO _free_count
  FROM public.enrollments e
  WHERE e.user_id = NEW.user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = e.payment_id AND o.status = 'completed' AND o.total > 0
    );

  SELECT min(enrolled_at) INTO _earliest
  FROM public.enrollments WHERE user_id = NEW.user_id;

  _total_months := 14.4 + GREATEST(_paid_count - 1, 0) * 6;
  IF _free_count > 0 THEN
    _total_months := _total_months + 6;
  END IF;

  NEW.valid_from := _earliest;
  NEW.valid_until := _earliest + (interval '1 month' * _total_months);
  NEW.is_active := true;
  NEW.download_blocked := false;
  IF TG_OP = 'UPDATE' THEN
    NEW.card_number := OLD.card_number;
  ELSIF NEW.card_number IS NULL OR length(btrim(NEW.card_number)) = 0 THEN
    NEW.card_number := 'OTS-ID-' || lpad(floor(random() * 900000 + 100000)::text, 6, '0');
  END IF;

  RETURN NEW;
END;
$function$;
