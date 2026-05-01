-- Security hardening migration

-- 1. Remove user_roles from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_roles;

-- 2. Explicit admin-only SELECT on sms_logs
DROP POLICY IF EXISTS "Only admins can read sms_logs" ON public.sms_logs;
CREATE POLICY "Only admins can read sms_logs"
  ON public.sms_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- 3. Tighten quizzes policy: no NULL course_id loophole for instructors
DROP POLICY IF EXISTS "Instructors manage quizzes of their courses" ON public.quizzes;
CREATE POLICY "Instructors manage quizzes of their courses"
  ON public.quizzes FOR ALL TO authenticated
  USING (
    (course_id IS NOT NULL AND can_manage_course(course_id))
    OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    (course_id IS NOT NULL AND can_manage_course(course_id))
    OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
  );

-- 4. Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated
-- These should only be called from triggers, edge functions (service role), or other definers
REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_wallet(uuid, numeric, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins(text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_ai_chats() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_update_workshop_status() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_name_change_cooldown() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_course_review_stats() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_contributor_vote_count() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_discussion_upvote_count() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_search_engines_on_publish() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_search_index_vector_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.forum_posts_search_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.workshops_sync_timestamps() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_slug_workshops() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_slug_courses() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_slug_ebooks() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_seo_courses() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_seo_ebooks() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_seo_workshops() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_seo_learning_paths() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_seo_research_papers() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_seo_posts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_seo_internships() FROM anon, authenticated;

-- 5. Move citext extension out of public schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION citext SET SCHEMA extensions;

-- 6. RLS Policy Always True - tighten "Anyone" insert policies that have no rate/abuse guard
-- workshop_registrations: require an authenticated user matching user_id, or session-based via edge function
-- We keep these accessible for public sign-ups, but the linter just warns. Real protection is via captcha/edge fn.
-- No changes here to avoid breaking public registration flows; linter warnings are acceptable for unauthenticated insert endpoints by design.
