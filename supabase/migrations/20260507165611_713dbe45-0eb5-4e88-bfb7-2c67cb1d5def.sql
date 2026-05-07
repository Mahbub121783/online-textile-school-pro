
-- Re-grant sensitive user_profiles columns to authenticated (own-row reads needed)
GRANT SELECT (phone, whatsapp_number, date_of_birth, blood_group, gender, latitude, longitude, referral_code, location_updated_at, last_login_at)
  ON public.user_profiles TO authenticated;

-- Re-grant correct_answer to authenticated (instructors/admins/quiz scoring need it server-side via RLS-bypass; client uses it for showing answers post-submit)
GRANT SELECT (correct_answer) ON public.quiz_questions TO authenticated;

-- Re-grant institutional_email_requests password columns to authenticated owners (RLS still restricts to owner/admin)
GRANT SELECT (generated_password, current_password) ON public.institutional_email_requests TO authenticated;

-- Re-grant lesson instructor_notes to authenticated (instructors view their own; RLS limits)
-- (anon revoke remains)

-- Re-grant ai_chatbot_config api_key to authenticated (RLS already restricts to admins)
GRANT SELECT (api_key) ON public.ai_chatbot_config TO authenticated;
