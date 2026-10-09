-- Two fixes requested together:
--  1. Approved campus ambassadors should get their ID card and
--     institutional email auto-approved (perk of the role), without
--     needing a paid course enrollment first -- that requirement exists
--     for ordinary students (db/66/67) but ambassadors earn the perk
--     through the program itself, not a purchase.
--  2. Public /verify-student only matched student_id_cards.card_number,
--     never user_profiles.roll_id -- so searching by the roll ID printed
--     everywhere else on the site (dashboard, leaderboard, profile cards)
--     always returned "not found", even for a genuine, currently-enrolled
--     student. roll_id is assigned to every account at signup
--     (handle_new_user(), already live) -- nothing to generate there, the
--     verify endpoint just never looked at it.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- ID card integrity: allow an approved ambassador through without a paid
-- enrollment. Validity is a flat 1 year from issuance (no enrollment
-- history to compute a tiered duration from, unlike the paid-student
-- path) -- re-running ensureStudentIdCard() later for an ambassador who
-- also becomes a paying student lets the normal paid-enrollment formula
-- take back over, since it only extends (never shortens) existing cards.
CREATE OR REPLACE FUNCTION public.enforce_student_id_card_integrity()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _privileged boolean;
  _paid_count integer;
  _free_count integer;
  _earliest timestamptz;
  _total_months numeric;
  _is_ambassador boolean;
BEGIN
  _privileged := (current_setting('request.jwt.claim.role', true) = 'service_role')
    OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin');
  IF _privileged THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.ambassador_applications WHERE user_id = NEW.user_id AND status = 'approved'
  ) INTO _is_ambassador;

  SELECT count(*) INTO _paid_count
  FROM public.enrollments e
  JOIN public.orders o ON o.id = e.payment_id
  WHERE e.user_id = NEW.user_id AND o.status = 'completed' AND o.total > 0;

  IF (_paid_count IS NULL OR _paid_count = 0) AND NOT _is_ambassador THEN
    RAISE EXCEPTION 'No paid enrollments -- cannot issue a student ID card' USING ERRCODE = '42501';
  END IF;

  IF _paid_count IS NULL OR _paid_count = 0 THEN
    -- Ambassador path: no enrollment history to compute a tiered duration
    -- from, so a flat 1-year card instead.
    NEW.valid_from := COALESCE(NEW.valid_from, now());
    NEW.valid_until := NEW.valid_from + interval '1 year';
  ELSE
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
  END IF;

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

\echo '--- sanity: function updated ---'
SELECT proname FROM pg_proc WHERE proname = 'enforce_student_id_card_integrity';
