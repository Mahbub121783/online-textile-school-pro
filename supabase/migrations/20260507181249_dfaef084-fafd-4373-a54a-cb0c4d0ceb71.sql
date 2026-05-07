
ALTER TABLE public.certificates ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE public.certificates DROP CONSTRAINT IF EXISTS certificates_user_id_course_id_key;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS workshop_id uuid REFERENCES public.workshops(id) ON DELETE CASCADE;
ALTER TABLE public.certificates DROP CONSTRAINT IF EXISTS certificates_target_check;
ALTER TABLE public.certificates ADD CONSTRAINT certificates_target_check
  CHECK ((course_id IS NOT NULL AND workshop_id IS NULL) OR (course_id IS NULL AND workshop_id IS NOT NULL));

CREATE UNIQUE INDEX IF NOT EXISTS certificates_user_course_uidx
  ON public.certificates(user_id, course_id) WHERE course_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS certificates_user_workshop_uidx
  ON public.certificates(user_id, workshop_id) WHERE workshop_id IS NOT NULL;

ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS cert_template_id uuid REFERENCES public.certificate_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS certificate_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS certificate_min_attendance_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS certificate_min_quiz_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS certificate_auto_issue boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.issue_workshop_certificate(_workshop_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.workshops;
  reg public.workshop_registrations;
  best_pct numeric := NULL;
  cert_no text;
  cert_id uuid;
  existing_id uuid;
  tpl jsonb;
BEGIN
  SELECT * INTO w FROM public.workshops WHERE id = _workshop_id;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Workshop not found'; END IF;
  IF NOT w.certificate_enabled OR w.cert_template_id IS NULL THEN
    RAISE EXCEPTION 'Certificate not enabled for this workshop';
  END IF;
  IF w.status <> 'completed' THEN
    RAISE EXCEPTION 'Workshop must be completed before issuing certificates';
  END IF;

  SELECT * INTO reg FROM public.workshop_registrations
    WHERE workshop_id = _workshop_id AND user_id = _user_id
    ORDER BY created_at DESC LIMIT 1;
  IF reg.id IS NULL THEN RAISE EXCEPTION 'User is not registered for this workshop'; END IF;

  SELECT id INTO existing_id FROM public.certificates
    WHERE workshop_id = _workshop_id AND user_id = _user_id;
  IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;

  IF w.certificate_min_attendance_pct > 0 AND reg.checked_in_at IS NULL THEN
    RAISE EXCEPTION 'Attendance requirement not met';
  END IF;

  SELECT MAX( (a.score::numeric / NULLIF(a.max_score,0)) * 100 )
    INTO best_pct
    FROM public.workshop_quiz_attempts a
    JOIN public.workshop_quizzes q ON q.id = a.quiz_id AND q.workshop_id = _workshop_id
    WHERE a.registration_id = reg.id;

  IF w.certificate_min_quiz_pct > 0 THEN
    IF best_pct IS NULL OR best_pct < w.certificate_min_quiz_pct THEN
      RAISE EXCEPTION 'Quiz score requirement not met';
    END IF;
  END IF;

  SELECT to_jsonb(t) INTO tpl FROM public.certificate_templates t WHERE t.id = w.cert_template_id;
  cert_no := 'WS-' || to_char(now(),'YYYY') || '-' || lpad(floor(random()*999999)::text,6,'0');

  INSERT INTO public.certificates(user_id, workshop_id, course_id, certificate_number, issued_at, score_percentage, template_snapshot)
  VALUES (_user_id, _workshop_id, NULL, cert_no, now(), ROUND(COALESCE(best_pct,0),2), tpl)
  ON CONFLICT (user_id, workshop_id) DO NOTHING
  RETURNING id INTO cert_id;

  IF cert_id IS NULL THEN
    SELECT id INTO cert_id FROM public.certificates WHERE workshop_id = _workshop_id AND user_id = _user_id;
  ELSE
    INSERT INTO public.notifications(user_id, type, title, message, link)
    VALUES (_user_id, 'certificate', 'Certificate ready',
      'Your certificate for "' || w.title || '" is ready to download.',
      '/dashboard/certificates');
  END IF;

  RETURN cert_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_workshop_certificate(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_issue_workshop_certificates(_workshop_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; issued int := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  FOR r IN SELECT user_id FROM public.workshop_registrations
            WHERE workshop_id = _workshop_id AND status = 'registered' AND user_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.issue_workshop_certificate(_workshop_id, r.user_id);
      issued := issued + 1;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
  RETURN issued;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_issue_workshop_certificates(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_workshop_auto_issue_certs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM 'completed')
     AND NEW.certificate_enabled
     AND NEW.certificate_auto_issue
     AND NEW.cert_template_id IS NOT NULL THEN
    FOR r IN SELECT user_id FROM public.workshop_registrations
              WHERE workshop_id = NEW.id AND status = 'registered' AND user_id IS NOT NULL
    LOOP
      BEGIN
        PERFORM public.issue_workshop_certificate(NEW.id, r.user_id);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workshop_auto_issue_certs ON public.workshops;
CREATE TRIGGER trg_workshop_auto_issue_certs
AFTER UPDATE OF status ON public.workshops
FOR EACH ROW EXECUTE FUNCTION public.tg_workshop_auto_issue_certs();
