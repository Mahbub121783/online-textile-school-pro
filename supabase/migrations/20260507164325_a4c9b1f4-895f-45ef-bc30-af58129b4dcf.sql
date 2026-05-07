CREATE OR REPLACE FUNCTION public.enforce_workshop_registration_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.workshops;
  cnt int;
  ends_at timestamptz;
BEGIN
  SELECT * INTO w FROM public.workshops WHERE id = NEW.workshop_id;
  IF w.id IS NULL THEN
    RAISE EXCEPTION 'Workshop not found' USING ERRCODE = 'check_violation';
  END IF;

  IF w.status IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'Registration closed: workshop is %', w.status USING ERRCODE = 'check_violation';
  END IF;

  IF w.registration_deadline IS NOT NULL AND now() > w.registration_deadline THEN
    RAISE EXCEPTION 'Registration deadline has passed' USING ERRCODE = 'check_violation';
  END IF;

  ends_at := COALESCE(
    w.end_at,
    ((COALESCE(w.end_date, w.start_date)::text || ' ' || COALESCE(w.end_time, w.start_time, '23:59:00'::time)::text)::timestamp AT TIME ZONE 'Asia/Dhaka')
  );
  IF ends_at IS NOT NULL AND now() > ends_at THEN
    RAISE EXCEPTION 'Workshop has already ended. Registration is closed.' USING ERRCODE = 'check_violation';
  END IF;

  IF w.max_participants IS NOT NULL THEN
    SELECT count(*) INTO cnt FROM public.workshop_registrations
      WHERE workshop_id = NEW.workshop_id AND status = 'registered';
    IF cnt >= w.max_participants THEN
      RAISE EXCEPTION 'Workshop is full' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_workshop_registration_window ON public.workshop_registrations;
CREATE TRIGGER trg_enforce_workshop_registration_window
BEFORE INSERT ON public.workshop_registrations
FOR EACH ROW EXECUTE FUNCTION public.enforce_workshop_registration_window();