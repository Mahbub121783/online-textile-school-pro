SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- ============================================================
-- 1. Auto-recompute card validity when enrollments/orders change
-- ============================================================
-- Card validity was only ever recalculated by ensureStudentIdCard.ts, which
-- runs in the browser and only when the student happens to open a page that
-- calls it. A student whose card was issued BEFORE they bought a paid course
-- therefore kept the shorter validity forever -- confirmed live: a card
-- issued 20 Aug with a paid order completing 21 Aug still showed the
-- pre-purchase 6-month window. Verification services read that short window
-- as a weaker enrollment claim, so recompute server-side instead.
--
-- Only ever EXTENDS (never shortens) an existing card, matching the
-- "only update if new validity is greater" rule the client used, so a
-- manually-extended card is never clawed back.
CREATE OR REPLACE FUNCTION public.recompute_student_id_card(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _paid_count integer;
  _free_count integer;
  _earliest timestamptz;
  _total_months numeric;
  _new_until timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.student_id_cards WHERE user_id = _user_id) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO _paid_count
  FROM public.enrollments e
  JOIN public.orders o ON o.id = e.payment_id
  WHERE e.user_id = _user_id AND o.status = 'completed' AND o.total > 0;

  -- No qualifying paid enrollment: leave the card exactly as-is. Raising
  -- here would abort the enrolment/order write that triggered us.
  IF _paid_count IS NULL OR _paid_count = 0 THEN
    RETURN;
  END IF;

  SELECT count(*) INTO _free_count
  FROM public.enrollments e
  WHERE e.user_id = _user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = e.payment_id AND o.status = 'completed' AND o.total > 0
    );

  SELECT min(enrolled_at) INTO _earliest
  FROM public.enrollments WHERE user_id = _user_id;

  _total_months := 14.4 + GREATEST(_paid_count - 1, 0) * 6;
  IF _free_count > 0 THEN
    _total_months := _total_months + 6;
  END IF;

  _new_until := _earliest + (interval '1 month' * _total_months);

  UPDATE public.student_id_cards
     SET valid_from  = LEAST(valid_from, _earliest),
         valid_until = GREATEST(valid_until, _new_until),
         updated_at  = now()
   WHERE user_id = _user_id
     AND (valid_until < _new_until OR valid_from > _earliest);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_id_card_from_enrollment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.recompute_student_id_card(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enrollments_recompute_id_card ON public.enrollments;
CREATE TRIGGER enrollments_recompute_id_card
AFTER INSERT OR UPDATE OF payment_id ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_id_card_from_enrollment();

-- An order flipping to 'completed' is what turns an existing enrollment from
-- free-looking into genuinely paid, so it must recompute too.
CREATE OR REPLACE FUNCTION public.trg_recompute_id_card_from_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.total > 0 THEN
    PERFORM public.recompute_student_id_card(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_recompute_id_card ON public.orders;
CREATE TRIGGER orders_recompute_id_card
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_id_card_from_order();

-- ============================================================
-- 2. Backfill every existing card
-- ============================================================
DO $$
DECLARE _u uuid;
BEGIN
  FOR _u IN SELECT DISTINCT user_id FROM public.student_id_cards LOOP
    PERFORM public.recompute_student_id_card(_u);
  END LOOP;
END $$;

-- ============================================================
-- 3. Profile whitespace hygiene
-- ============================================================
-- department was stored as 'Fabric manufacturing ' (trailing space), which
-- rendered on the verification letter as "Department of Fabric manufacturing )".
-- Verification reviewers read sloppy formatting as a sign of a non-official
-- document, so trim the stored values and keep them trimmed on write.
UPDATE public.user_profiles
   SET full_name  = NULLIF(btrim(full_name), ''),
       department = NULLIF(btrim(department), ''),
       campus     = NULLIF(btrim(campus), '')
 WHERE full_name  IS DISTINCT FROM NULLIF(btrim(full_name), '')
    OR department IS DISTINCT FROM NULLIF(btrim(department), '')
    OR campus     IS DISTINCT FROM NULLIF(btrim(campus), '');

CREATE OR REPLACE FUNCTION public.trg_trim_user_profile_text()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.full_name  := NULLIF(btrim(NEW.full_name), '');
  NEW.department := NULLIF(btrim(NEW.department), '');
  NEW.campus     := NULLIF(btrim(NEW.campus), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_trim_text ON public.user_profiles;
CREATE TRIGGER user_profiles_trim_text
BEFORE INSERT OR UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_trim_user_profile_text();

-- ============================================================
-- 4. Course title typo (shows on every enrollment letter)
-- ============================================================
UPDATE public.courses
   SET title = 'The Textile Engineers Internship Accelerator'
 WHERE title = 'The Textile Engineers Internship Accelerato';
