-- 1) Hide workshop meeting links from anonymous visitors
REVOKE SELECT (meet_link) ON public.workshops FROM anon;
REVOKE SELECT (meet_link) ON public.workshop_sessions FROM anon;

-- 2) Hide PII columns on user_profiles from anonymous visitors
REVOKE SELECT (phone, whatsapp_number, date_of_birth, blood_group, latitude, longitude, district, division, upazila)
  ON public.user_profiles FROM anon;

-- 3) Workshop sessions: drop email-JWT-based match (spoofable), keep user_id check
DROP POLICY IF EXISTS "Registered or staff can view workshop sessions" ON public.workshop_sessions;
CREATE POLICY "Registered or staff can view workshop sessions"
  ON public.workshop_sessions
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.workshop_registrations wr
      WHERE wr.workshop_id = workshop_sessions.workshop_id
        AND wr.user_id = auth.uid()
    )
  );

-- 4) Enrollments: prevent self-enroll into paid courses (payment must go through process-payment edge function which uses service role)
DROP POLICY IF EXISTS "Users can insert own enrollments" ON public.enrollments;
CREATE POLICY "Users can self-enroll in free courses"
  ON public.enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = enrollments.course_id
        AND c.is_published = true
        AND COALESCE(c.price, 0) = 0
    )
  );
