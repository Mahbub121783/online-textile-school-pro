-- db/29's approval-gate fix for courses/ebooks had a real regression:
-- the WITH CHECK required is_published=false (and review_status in
-- draft/pending) in the RESULTING row for any non-admin write. That's
-- fine for a genuinely new draft, but for an ALREADY-published course/
-- ebook, an instructor editing their own content (fixing a typo, price,
-- etc.) without explicitly re-submitting is_published=false in the same
-- payload would keep is_published=true (columns not in the UPDATE SET
-- list keep their existing value) -- which the non-admin WITH CHECK
-- branch then rejects, blocking ALL edits to already-published content.
-- Confirmed as the likely cause of "new course/ebook add korle load
-- hocche na" complaints once instructors tried touching existing rows.
--
-- Fix: revert the RLS policy to a plain ownership check (matches the
-- original, working behavior), and instead enforce "only admin/
-- super_admin may ever turn is_published on, or approve review_status"
-- via a trigger that only intervenes on an actual escalation attempt --
-- never touches unrelated edits, and never blocks admin at all.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

DROP POLICY IF EXISTS "Instructors and admins manage courses" ON public.courses;
CREATE POLICY "Instructors and admins manage courses" ON public.courses
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (instructor_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (instructor_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

DROP POLICY IF EXISTS "Instructors manage own ebooks" ON public.ebooks;
CREATE POLICY "Instructors manage own ebooks" ON public.ebooks
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

CREATE OR REPLACE FUNCTION public.tg_enforce_publish_approval()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _uid uuid; _is_priv boolean;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW; -- trusted backend code (imports, admin bulk tools) is never gated
  END IF;
  _uid := NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
  _is_priv := has_role(_uid, 'admin') OR has_role(_uid, 'super_admin');
  IF _is_priv THEN
    RETURN NEW;
  END IF;

  -- Non-privileged writer (the content's own instructor). Only intervene
  -- if they're actually trying to turn publication ON -- leave every
  -- other field (and de-publishing their own content) untouched.
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_published IS TRUE THEN NEW.is_published := false; END IF;
    IF NEW.review_status = 'approved' THEN NEW.review_status := 'pending'; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_published IS TRUE AND (OLD.is_published IS NOT TRUE) THEN
      NEW.is_published := false;
    END IF;
    IF NEW.review_status = 'approved' AND COALESCE(OLD.review_status, '') <> 'approved' THEN
      NEW.review_status := 'pending';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_courses_enforce_publish_approval ON public.courses;
CREATE TRIGGER trg_courses_enforce_publish_approval
BEFORE INSERT OR UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_publish_approval();

DROP TRIGGER IF EXISTS trg_ebooks_enforce_publish_approval ON public.ebooks;
CREATE TRIGGER trg_ebooks_enforce_publish_approval
BEFORE INSERT OR UPDATE ON public.ebooks
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_publish_approval();
