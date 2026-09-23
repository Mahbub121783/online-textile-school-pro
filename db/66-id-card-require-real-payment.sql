SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- `enrollments.payment_id` is set to the order id for EVERY enrollment that
-- goes through checkout, including $0 free-course self-enrollment
-- (CourseDetail.tsx) and coupon-discounted-to-zero paid checkouts
-- (checkoutFinalize.js) -- it is not, by itself, proof that money changed
-- hands. This function previously used `payment_id IS NOT NULL` as its
-- "paid enrollment" test, which let any free-course enrollment qualify a
-- student for an ID card / enrollment letters meant only for paying
-- students. Now requires the enrollment's order to have actually completed
-- with a nonzero total.
CREATE OR REPLACE FUNCTION public.enforce_student_id_card_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _privileged boolean;
  _count integer;
  _earliest timestamptz;
BEGIN
  _privileged := (current_setting('request.jwt.claim.role', true) = 'service_role')
    OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin');
  IF _privileged THEN
    RETURN NEW;
  END IF;

  SELECT count(*), min(e.enrolled_at) INTO _count, _earliest
  FROM public.enrollments e
  JOIN public.orders o ON o.id = e.payment_id
  WHERE e.user_id = NEW.user_id AND o.status = 'completed' AND o.total > 0;

  IF _count IS NULL OR _count = 0 THEN
    RAISE EXCEPTION 'No paid enrollments -- cannot issue a student ID card' USING ERRCODE = '42501';
  END IF;

  NEW.valid_from := _earliest;
  NEW.valid_until := _earliest + (_count * interval '6 months');
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
