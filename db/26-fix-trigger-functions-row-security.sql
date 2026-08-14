-- Systemic bug affecting every trigger-maintained denormalized counter on
-- the platform: video views_count, likes_count, comments_count, comment
-- like counts, contributor vote_count, course avg_rating/review_count, and
-- discussion upvote_count all silently stopped updating for anyone who
-- isn't the target row's owner/admin.
--
-- Root cause: this self-host migration set FORCE ROW LEVEL SECURITY on
-- every table (db/04-force-rls.sql), needed because tecnedub_ots_app owns
-- every table and would otherwise bypass RLS entirely as the owner. But
-- SECURITY DEFINER only elevates *privilege* checks (grants) -- it does
-- NOT bypass RLS, which is always evaluated against the CURRENT SESSION's
-- role/GUCs. So when e.g. a student (who owns none of the target rows)
-- likes a video, the AFTER INSERT trigger's internal
-- `UPDATE class_videos SET likes_count = likes_count + 1` runs under the
-- STUDENT's own session context and gets silently rejected by
-- class_videos' owner/staff-only UPDATE policy (UPDATE-with-0-visible-rows
-- fails silently, no error -- same class as the earlier enrollments/
-- assignment_submissions bugs, just triggered from inside a trigger this
-- time instead of a direct API call).
--
-- Confirmed live: views_count stayed at 1 after 3 more distinct real
-- viewers watched the same video.
--
-- First attempt (`SET row_security = off` on the function) does NOT work:
-- FORCE ROW LEVEL SECURITY explicitly overrides that escape hatch even for
-- the table owner (confirmed live: "query would be affected by row-level
-- security policy for table class_videos"). The correct fix, consistent
-- with every other service_role-branch fix this migration has needed
-- (db/07, db/17, db/19, db/21, db/22, db/23, db/24, db/25): the trigger
-- elevates its OWN session's role GUC to service_role (transaction-local,
-- restored immediately after) just around its own internal UPDATE, and the
-- target tables' write policies get an explicit service_role branch --
-- exactly the same pattern the Node backend already relies on for its own
-- privileged writes, just invoked from inside a trigger instead of
-- server.js.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

DROP POLICY IF EXISTS "videos_admin_all" ON public.class_videos;
CREATE POLICY "videos_admin_all" ON public.class_videos
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'instructor')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'instructor')
  );

DROP POLICY IF EXISTS "video_comments_update_own" ON public.class_video_comments;
CREATE POLICY "video_comments_update_own" ON public.class_video_comments
  FOR UPDATE
  USING (auth.role() = 'service_role' OR auth.uid() = user_id)
  WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);

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

DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
CREATE POLICY "Users update own profile" ON public.user_profiles
  FOR UPDATE
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND id = auth.uid()))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND id = auth.uid()));

DROP POLICY IF EXISTS "Owners and admins manage discussions" ON public.discussions;
CREATE POLICY "Owners and admins manage discussions" ON public.discussions
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

-- Each trigger below now brackets its own internal UPDATE with a
-- transaction-local role elevation, restoring the caller's real role
-- immediately after (so it can't affect any other statement that might run
-- later in the same transaction).

CREATE OR REPLACE FUNCTION public.tg_class_video_views_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _prev_role text;
BEGIN
  _prev_role := current_setting('request.jwt.claim.role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.class_videos SET views_count = views_count + 1 WHERE id = new.video_id;
  PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.tg_class_video_likes_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _prev_role text;
BEGIN
  _prev_role := current_setting('request.jwt.claim.role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  IF tg_op = 'INSERT' THEN
    UPDATE public.class_videos SET likes_count = likes_count + 1 WHERE id = new.video_id;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.class_videos SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = old.video_id;
  END IF;
  PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.tg_class_video_comments_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _prev_role text;
BEGIN
  _prev_role := current_setting('request.jwt.claim.role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  IF tg_op = 'INSERT' THEN
    UPDATE public.class_videos SET comments_count = comments_count + 1 WHERE id = new.video_id;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.class_videos SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = old.video_id;
  END IF;
  PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.tg_class_video_comment_likes_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _prev_role text;
BEGIN
  _prev_role := current_setting('request.jwt.claim.role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  IF tg_op = 'INSERT' THEN
    UPDATE public.class_video_comments SET likes_count = likes_count + 1 WHERE id = new.comment_id;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.class_video_comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = old.comment_id;
  END IF;
  PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.tg_lessons_recalc_course_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cid uuid;
  _prev_role text;
BEGIN
  _prev_role := current_setting('request.jwt.claim.role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  IF (TG_OP = 'DELETE') THEN
    SELECT course_id INTO _cid FROM public.course_sections WHERE id = OLD.section_id;
    IF _cid IS NOT NULL THEN PERFORM public.recalc_course_lesson_stats(_cid); END IF;
    PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
    RETURN OLD;
  ELSE
    SELECT course_id INTO _cid FROM public.course_sections WHERE id = NEW.section_id;
    IF _cid IS NOT NULL THEN PERFORM public.recalc_course_lesson_stats(_cid); END IF;
    IF (TG_OP = 'UPDATE') AND NEW.section_id IS DISTINCT FROM OLD.section_id THEN
      DECLARE _old_cid uuid;
      BEGIN
        SELECT course_id INTO _old_cid FROM public.course_sections WHERE id = OLD.section_id;
        IF _old_cid IS NOT NULL AND _old_cid IS DISTINCT FROM _cid THEN
          PERFORM public.recalc_course_lesson_stats(_old_cid);
        END IF;
      END;
    END IF;
    PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
    RETURN NEW;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_contributor_vote_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _prev_role text;
BEGIN
  _prev_role := current_setting('request.jwt.claim.role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_profiles SET vote_count = vote_count + 1 WHERE id = NEW.contributor_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_profiles SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.contributor_id;
  END IF;
  PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_course_review_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _course_id uuid;
  _prev_role text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _course_id := OLD.course_id;
  ELSE
    _course_id := NEW.course_id;
  END IF;

  _prev_role := current_setting('request.jwt.claim.role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE courses SET
    avg_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE course_id = _course_id AND is_approved = true), 0),
    review_count = COALESCE((SELECT COUNT(*)::integer FROM reviews WHERE course_id = _course_id AND is_approved = true), 0)
  WHERE id = _course_id;
  PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_discussion_upvote_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _prev_role text;
BEGIN
  _prev_role := current_setting('request.jwt.claim.role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE discussions SET upvote_count = upvote_count + 1 WHERE id = NEW.discussion_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE discussions SET upvote_count = upvote_count - 1 WHERE id = OLD.discussion_id;
  END IF;
  PERFORM set_config('request.jwt.claim.role', COALESCE(_prev_role, ''), true);
  RETURN NULL;
END;
$function$;

-- One-time backfill: recompute course rating stats and video counts from
-- the real underlying tables now, since these triggers have likely been
-- silently no-op'ing since launch for anyone who wasn't the row's owner.
UPDATE courses c SET
  avg_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE course_id = c.id AND is_approved = true), 0),
  review_count = COALESCE((SELECT COUNT(*)::integer FROM reviews WHERE course_id = c.id AND is_approved = true), 0);

UPDATE class_videos v SET
  views_count = COALESCE((SELECT COUNT(*) FROM class_video_views WHERE video_id = v.id), 0),
  likes_count = COALESCE((SELECT COUNT(*) FROM class_video_likes WHERE video_id = v.id), 0),
  comments_count = COALESCE((SELECT COUNT(*) FROM class_video_comments WHERE video_id = v.id), 0);
