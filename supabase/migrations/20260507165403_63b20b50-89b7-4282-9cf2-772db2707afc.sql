
-- ========= workshop_registrations: drop anon read =========
DROP POLICY IF EXISTS "Anon can read registrations" ON public.workshop_registrations;

-- ========= registrations: drop anon read =========
DROP POLICY IF EXISTS "Anon can read registrations for suggestions" ON public.registrations;

-- ========= workshop_quiz_attempts: lock down =========
DROP POLICY IF EXISTS "Anyone can insert quiz attempts" ON public.workshop_quiz_attempts;
DROP POLICY IF EXISTS "Anyone can view own attempts" ON public.workshop_quiz_attempts;

CREATE POLICY "Authenticated can insert own attempts"
  ON public.workshop_quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workshop_registrations wr
      WHERE wr.id = workshop_quiz_attempts.registration_id
        AND (wr.user_id = auth.uid() OR wr.email = (auth.jwt() ->> 'email'))
    )
  );

CREATE POLICY "Users can view own attempts"
  ON public.workshop_quiz_attempts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workshop_registrations wr
      WHERE wr.id = workshop_quiz_attempts.registration_id
        AND (wr.user_id = auth.uid() OR wr.email = (auth.jwt() ->> 'email'))
    )
  );

-- ========= payment_gateways: admin only SELECT =========
DROP POLICY IF EXISTS "Authenticated users can view gateways" ON public.payment_gateways;

-- ========= cloudflare_r2_accounts: drop instructor read =========
DROP POLICY IF EXISTS "Instructors read R2 accounts" ON public.cloudflare_r2_accounts;

-- ========= cloudinary_accounts: drop instructor read =========
DROP POLICY IF EXISTS "Admins and instructors read cloudinary accounts" ON public.cloudinary_accounts;

-- ========= ai_chatbot_config: ensure no public/auth read of api_key =========
-- Existing policies are admin-only ALL; revoke direct column SELECT from non-admin roles defensively.
REVOKE SELECT (api_key) ON public.ai_chatbot_config FROM anon, authenticated;

-- ========= live_classes: restrict meeting_url =========
DROP POLICY IF EXISTS "Authenticated can view live_classes" ON public.live_classes;

CREATE POLICY "Enrolled or staff can view live_classes"
  ON public.live_classes FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'instructor'::app_role)
    OR (course_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = live_classes.course_id AND e.user_id = auth.uid()
    ))
    OR (batch_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.batch_students bs
      WHERE bs.batch_id = live_classes.batch_id AND bs.user_id = auth.uid()
    ))
  );

-- ========= workshop_sessions: restrict meet_link =========
DROP POLICY IF EXISTS "Anyone can view workshop sessions" ON public.workshop_sessions;

CREATE POLICY "Registered or staff can view workshop sessions"
  ON public.workshop_sessions FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.workshop_registrations wr
      WHERE wr.workshop_id = workshop_sessions.workshop_id
        AND (wr.user_id = auth.uid() OR wr.email = (auth.jwt() ->> 'email'))
    )
  );

-- ========= workshops: hide meet_link from non-registered (column grant) =========
REVOKE SELECT (meet_link) ON public.workshops FROM anon;
-- Authenticated users still need it conditionally; enforce via app filter — full revoke would break instructor flows.
-- Replace public broad SELECT with one excluding meet_link column for anon by column grant above.

-- ========= quiz_questions: hide correct_answer from public reads =========
DROP POLICY IF EXISTS "Enrolled users can view questions" ON public.quiz_questions;

CREATE POLICY "Authenticated can view questions"
  ON public.quiz_questions FOR SELECT TO authenticated
  USING (true);

REVOKE SELECT (correct_answer) ON public.quiz_questions FROM anon, authenticated;

-- ========= lessons: hide instructor_notes from anon =========
REVOKE SELECT (instructor_notes) ON public.lessons FROM anon;

-- ========= faculty_members: hide phone/email from anon =========
REVOKE SELECT (phone, email) ON public.faculty_members FROM anon;

-- ========= user_profiles: hide PII from anon and other authenticated users =========
-- Replace overly permissive public SELECT with a public-safe policy that only exposes safe columns via column grants.
-- Strategy: keep policy permissive for SELECT but revoke SELECT on sensitive columns from anon/authenticated; users keep access to their own row via separate grants.
REVOKE SELECT (phone, whatsapp_number, date_of_birth, blood_group, gender, latitude, longitude, referral_code, location_updated_at, last_login_at)
  ON public.user_profiles FROM anon, authenticated;

-- Users still need to view their own sensitive fields. Provide via SECURITY DEFINER function.
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.user_profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.user_profiles WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- ========= storage.objects 'media' bucket: ownership-checked UPDATE =========
DROP POLICY IF EXISTS "Authenticated users can update media" ON storage.objects;

CREATE POLICY "Owners or admins can update media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.media_library ml
        WHERE ml.file_url LIKE '%' || storage.objects.name || '%'
          AND ml.uploaded_by = auth.uid()
      )
      OR owner = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'media' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.media_library ml
        WHERE ml.file_url LIKE '%' || storage.objects.name || '%'
          AND ml.uploaded_by = auth.uid()
      )
      OR owner = auth.uid()
    )
  );

-- ========= institutional_email_requests: hide plaintext password columns from non-admins =========
REVOKE SELECT (generated_password, current_password) ON public.institutional_email_requests FROM anon, authenticated;
