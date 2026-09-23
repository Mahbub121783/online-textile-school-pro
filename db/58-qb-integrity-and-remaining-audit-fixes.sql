-- Second audit wave: admin CMS/instructor, forum, question bank/exams,
-- research papers, referral, and AI tutor. Each section is an independently
-- verified live bug.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- =====================================================================
-- 1. student_grades / gradebook_manual_marks: "instructor" policies had no
-- course-ownership check at all -- ANY instructor could write grades for a
-- course they don't teach. Add the same can_manage_course(course_id) check
-- every other instructor-scoped policy in this codebase already uses.
-- =====================================================================
DROP POLICY IF EXISTS "Instructors can manage grades" ON public.student_grades;
CREATE POLICY "Instructors can manage grades" ON public.student_grades FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND public.can_manage_course(course_id)))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND public.can_manage_course(course_id)));

DROP POLICY IF EXISTS "Instructors manage gradebook marks" ON public.gradebook_manual_marks;
CREATE POLICY "Instructors manage gradebook marks" ON public.gradebook_manual_marks FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND public.can_manage_course(course_id)))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND public.can_manage_course(course_id)));

-- =====================================================================
-- 2. plagiarism_reports: no UNIQUE(submission_id) -- the exact bug class
-- fixed 4 times already today. Both call sites' onConflict:'submission_id'
-- silently fall back to re-inserting a duplicate row on every re-check.
-- Dedup (keep the newest row per submission) before adding the constraint.
-- =====================================================================
DELETE FROM public.plagiarism_reports a USING public.plagiarism_reports b
  WHERE a.submission_id = b.submission_id AND a.created_at < b.created_at;
DELETE FROM public.plagiarism_reports a USING public.plagiarism_reports b
  WHERE a.submission_id = b.submission_id AND a.created_at = b.created_at AND a.id < b.id;
ALTER TABLE public.plagiarism_reports DROP CONSTRAINT IF EXISTS plagiarism_reports_submission_id_key;
ALTER TABLE public.plagiarism_reports ADD CONSTRAINT plagiarism_reports_submission_id_key UNIQUE (submission_id);

-- =====================================================================
-- 3. discussions / forum_posts: owner-editable UPDATE policies had no (or
-- no-op) WITH CHECK, so the post's own author could set is_pinned/
-- is_answered/upvote_count directly -- fields the UI treats as
-- instructor/admin/vote-derived only. Pin every non-content column to its
-- current value for a non-admin owner-update; admins keep full control.
-- =====================================================================
DROP POLICY IF EXISTS "Owners and admins manage discussions" ON public.discussions;
CREATE POLICY "Owners and admins manage discussions" ON public.discussions FOR UPDATE
  USING (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)
      OR (
        user_id = auth.uid()
        AND is_pinned = discussions.is_pinned
        AND is_answered = discussions.is_answered
        AND upvote_count = discussions.upvote_count
        AND is_closed = discussions.is_closed
      )
    )
  );

DROP POLICY IF EXISTS "Owner or admin update forum posts" ON public.forum_posts;
CREATE POLICY "Owner or admin update forum posts" ON public.forum_posts FOR UPDATE
  USING (auth.role() = 'authenticated' AND (auth.uid() = user_id OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)
      OR (auth.uid() = user_id AND is_pinned = forum_posts.is_pinned AND is_closed = forum_posts.is_closed)
    )
  );

-- =====================================================================
-- 4. forum_contributor_points: points/action were entirely client-set on
-- direct insert (no server function backs this table). Clamp points to the
-- server-known value for the given action on every non-service insert,
-- instead of trusting whatever the client sent -- self-correcting rather
-- than breaking the existing direct-insert pattern the frontend already uses.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.enforce_forum_contributor_points()
RETURNS trigger AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;
  NEW.points := CASE NEW.action WHEN 'post' THEN 10 WHEN 'reply' THEN 5 WHEN 'react' THEN 1 ELSE 0 END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_forum_contributor_points ON public.forum_contributor_points;
CREATE TRIGGER trg_enforce_forum_contributor_points BEFORE INSERT ON public.forum_contributor_points
  FOR EACH ROW EXECUTE FUNCTION public.enforce_forum_contributor_points();

-- =====================================================================
-- 5. research_paper_access: "Users can insert their own access" let anyone
-- self-grant access to ANY paper (paid or free) with zero payment check --
-- confirmed no backend code anywhere ever legitimately inserts this table,
-- so this closes a pure free-unlock hole without touching any working flow.
-- =====================================================================
DROP POLICY IF EXISTS "Users can insert their own access" ON public.research_paper_access;
DROP POLICY IF EXISTS "Admins grant research paper access" ON public.research_paper_access;
CREATE POLICY "Admins grant research paper access" ON public.research_paper_access FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')))
  );

-- =====================================================================
-- 6. Question Bank (qb_*): every write policy in this subsystem only
-- checked row ownership, not value/column integrity, because the RPC
-- functions run under the CALLER's own GUC role (SECURITY DEFINER changes
-- Postgres execution privileges for grants, but NOT the GUC-based
-- auth.uid()/auth.role() this app's RLS reads -- see db/37/db/39's own
-- comments documenting this exact mechanism). The self-host fix for that
-- was to open the RLS policies to the student's own role instead of
-- elevating inside the functions (matching credit_wallet's pattern) --
-- which "fixed" the functional bug but reopened the underlying hole:
--   - qb_questions read exposed correct_answer to any authenticated user
--   - qb_exam_sessions could be inserted/updated directly, letting a
--     student fabricate a fully "passed" result with no payment and no
--     grading
--   - qb_user_tokens/qb_token_ledger could be self-edited (unlimited
--     practice-credit minting)
--   - qb_user_stats/qb_user_badges could be self-edited (fabricated
--     XP/streak/exam counts, self-awarded badges)
-- Fix: tighten every one of these back to service_role-only writes (like
-- wallet_transactions/fabric_hanger_stock_transactions already are), and
-- add the credit_wallet-style self-elevation inside each RPC function so
-- the legitimate flow keeps working.
-- =====================================================================

-- 6a. qb_questions: split public read (no correct_answer) from staff-only
-- full read. A plain view does NOT bypass the base table's RLS (views are
-- evaluated under the same GUC-based auth.role() as a direct query, so a
-- "public" view over a staff-only table would just return zero rows to
-- students) -- so this needs the same SECURITY DEFINER + explicit
-- service_role-elevation pattern as the RPC functions below, with the
-- function's RETURNS TABLE column list itself acting as the true
-- column-level restriction (correct_answer is never selected, so it can
-- never appear in the result regardless of RLS).
DROP POLICY IF EXISTS "qb_questions_auth_read" ON public.qb_questions;
CREATE POLICY "qb_questions_staff_read" ON public.qb_questions FOR SELECT
  USING (auth.role() = 'service_role' OR public.qb_is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.qb_count_exam_questions(_subject_id uuid, _difficulty qb_difficulty, _topic_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  SELECT count(*) INTO _n FROM public.qb_questions
    WHERE subject_id = _subject_id AND difficulty = _difficulty AND is_active = true
      AND (_topic_id IS NULL OR topic_id = _topic_id);
  RETURN _n;
END $$;

CREATE OR REPLACE FUNCTION public.qb_count_active_questions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  SELECT count(*) INTO _n FROM public.qb_questions WHERE is_active = true;
  RETURN _n;
END $$;

CREATE OR REPLACE FUNCTION public.qb_get_exam_questions(_ids uuid[])
RETURNS TABLE(id uuid, question_text text, question_type qb_question_type, options jsonb, points integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  RETURN QUERY
    SELECT q.id, q.question_text, q.question_type, q.options, q.points
    FROM public.qb_questions q WHERE q.id = ANY(_ids) AND q.is_active = true;
END $$;

-- 6b. qb_exam_sessions: no direct client writes at all -- only the
-- self-elevating RPC functions below (qb_start_exam, qb_submit_exam,
-- qb_log_violation, qb_heartbeat, qb_log_violations_batch) may create/
-- update a session.
DROP POLICY IF EXISTS "qb_sessions_own_insert" ON public.qb_exam_sessions;
DROP POLICY IF EXISTS "qb_sessions_own_update" ON public.qb_exam_sessions;
CREATE POLICY "Service role writes exam sessions" ON public.qb_exam_sessions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role updates exam sessions" ON public.qb_exam_sessions FOR UPDATE
  USING (auth.role() = 'service_role');

-- Anti-cheat logging functions -- also write qb_exam_sessions
-- (violation_count/resume_count/focus_mode_used/last_heartbeat_at), so they
-- need the same elevation now that direct client writes are locked out.
CREATE OR REPLACE FUNCTION public.qb_log_violation(_session_id UUID, _type TEXT, _metadata JSONB DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.qb_exam_sessions WHERE id = _session_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  INSERT INTO public.qb_exam_violations (session_id, user_id, type, metadata)
  VALUES (_session_id, _uid, _type, COALESCE(_metadata, '{}'::jsonb));
  UPDATE public.qb_exam_sessions
    SET violation_count = violation_count + 1,
        resume_count = CASE WHEN _type = 'session_resumed' THEN resume_count + 1 ELSE resume_count END,
        focus_mode_used = CASE WHEN _type = 'focus_mode_entered' THEN true ELSE focus_mode_used END
    WHERE id = _session_id;
END $$;

CREATE OR REPLACE FUNCTION public.qb_heartbeat(_session_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.qb_exam_sessions
    SET last_heartbeat_at = now()
    WHERE id = _session_id AND user_id = auth.uid() AND submitted_at IS NULL;
END $$;

CREATE OR REPLACE FUNCTION public.qb_log_violations_batch(_session_id uuid, _events jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _has_resume BOOLEAN; _has_focus BOOLEAN; _added INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.qb_exam_sessions WHERE id = _session_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  WITH src AS (
    SELECT (e->>'type')::text AS t, COALESCE(e->'metadata','{}'::jsonb) AS m
    FROM jsonb_array_elements(_events) e
  ),
  ins AS (
    INSERT INTO public.qb_exam_violations (session_id, user_id, type, metadata)
    SELECT _session_id, _uid, t, m FROM src
    RETURNING 1
  )
  SELECT COUNT(*) INTO _added FROM ins;

  SELECT bool_or(t='session_resumed'), bool_or(t='focus_mode_entered')
    INTO _has_resume, _has_focus
    FROM (SELECT (e->>'type') AS t FROM jsonb_array_elements(_events) e) s;

  UPDATE public.qb_exam_sessions
    SET violation_count = violation_count + COALESCE(_added,0),
        resume_count = resume_count + CASE WHEN _has_resume THEN 1 ELSE 0 END,
        focus_mode_used = focus_mode_used OR COALESCE(_has_focus,false)
    WHERE id = _session_id;
END $$;

-- 6c. qb_exam_answers: same -- only qb_submit_exam may write these.
DROP POLICY IF EXISTS "qb_answers_own_write" ON public.qb_exam_answers;
DROP POLICY IF EXISTS "qb_answers_own_update" ON public.qb_exam_answers;
CREATE POLICY "Service role writes exam answers" ON public.qb_exam_answers FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role updates exam answers" ON public.qb_exam_answers FOR UPDATE
  USING (auth.role() = 'service_role');

-- 6d. qb_user_tokens / qb_token_ledger: revert db/37's permissive
-- self-write policies now that the functions self-elevate instead.
DROP POLICY IF EXISTS "users insert own tokens" ON public.qb_user_tokens;
DROP POLICY IF EXISTS "users update own tokens" ON public.qb_user_tokens;
CREATE POLICY "Service role writes tokens" ON public.qb_user_tokens FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role updates tokens" ON public.qb_user_tokens FOR UPDATE
  USING (auth.role() = 'service_role');
-- qb_get_token_status/qb_consume_tokens both use `RETURNING ... INTO`, which
-- (unlike a plain INSERT/UPDATE with no RETURNING) requires the affected row
-- to also be SELECT-visible under whatever role is active at that point --
-- which is now 'service_role' post-elevation, not 'authenticated'. Without
-- this branch the elevated INSERT/UPDATE itself succeeds but the RETURNING
-- clause has no visible row to return, surfacing as an RLS violation.
DROP POLICY IF EXISTS "users read own tokens" ON public.qb_user_tokens;
CREATE POLICY "users read own tokens" ON public.qb_user_tokens
  FOR SELECT USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND user_id = auth.uid()));

DROP POLICY IF EXISTS "users insert own ledger" ON public.qb_token_ledger;
CREATE POLICY "Service role writes ledger" ON public.qb_token_ledger FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 6e. qb_user_stats / qb_user_badges: revert db/39's permissive additions.
DROP POLICY IF EXISTS "users insert own stats" ON public.qb_user_stats;
DROP POLICY IF EXISTS "Users update own stats" ON public.qb_user_stats;
CREATE POLICY "Service role writes stats" ON public.qb_user_stats FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role updates stats" ON public.qb_user_stats FOR UPDATE
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "users insert own badges" ON public.qb_user_badges;
CREATE POLICY "Service role writes badges" ON public.qb_user_badges FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 6f. Self-elevating RPC functions -- exact current bodies (db/39 for
-- qb_start_exam with resume support; latest supabase/migrations definitions
-- for the rest, none superseded by a later db/*.sql file) with one added
-- line per function: elevate to service_role only AFTER this function's own
-- auth.uid()/ownership checks have already passed, matching credit_wallet's
-- pattern but suited to a directly-client-callable RPC rather than a
-- backend-only one.
CREATE OR REPLACE FUNCTION public.qb_get_token_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.qb_user_tokens%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  INSERT INTO public.qb_user_tokens(user_id, daily_balance, paid_balance, last_refill_date)
  VALUES (_uid, 20, 0, CURRENT_DATE)
  ON CONFLICT (user_id) DO UPDATE SET
    daily_balance = CASE WHEN public.qb_user_tokens.last_refill_date < CURRENT_DATE THEN 20 ELSE public.qb_user_tokens.daily_balance END,
    last_refill_date = CASE WHEN public.qb_user_tokens.last_refill_date < CURRENT_DATE THEN CURRENT_DATE ELSE public.qb_user_tokens.last_refill_date END,
    updated_at = now()
  RETURNING * INTO _row;
  RETURN jsonb_build_object(
    'daily_balance', _row.daily_balance,
    'paid_balance', _row.paid_balance,
    'last_refill_date', _row.last_refill_date,
    'is_staff', public.qb_is_staff(_uid)
  );
END $$;

CREATE OR REPLACE FUNCTION public.qb_consume_tokens(_cost integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _avail int;
  _take_daily int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.qb_is_staff(_uid) THEN RETURN; END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  PERFORM public.qb_get_token_status();

  SELECT daily_balance + paid_balance INTO _avail FROM public.qb_user_tokens WHERE user_id = _uid;
  IF COALESCE(_avail,0) < _cost THEN
    RAISE EXCEPTION 'insufficient_tokens' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.qb_user_tokens t SET
    daily_balance = GREATEST(daily_balance - _cost, 0),
    paid_balance = paid_balance - GREATEST(_cost - daily_balance, 0),
    updated_at = now()
  WHERE user_id = _uid
  RETURNING (LEAST(daily_balance + GREATEST(_cost - daily_balance, 0), _cost)) INTO _take_daily;

  INSERT INTO public.qb_token_ledger(user_id, delta, reason)
  VALUES (_uid, -_cost, 'exam_start');
END $$;

CREATE OR REPLACE FUNCTION public.qb_credit_paid_tokens(_credits integer, _order_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _credits <= 0 THEN RETURN; END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  INSERT INTO public.qb_user_tokens(user_id, daily_balance, paid_balance, last_refill_date)
  VALUES (_uid, 20, _credits, CURRENT_DATE)
  ON CONFLICT (user_id) DO UPDATE SET paid_balance = public.qb_user_tokens.paid_balance + _credits, updated_at = now();
  INSERT INTO public.qb_token_ledger(user_id, delta, reason, ref_id)
  VALUES (_uid, _credits, 'purchase', _order_id);
END $$;

CREATE OR REPLACE FUNCTION public.qb_start_exam(_subject_id uuid, _difficulty qb_difficulty, _topic_id uuid DEFAULT NULL::uuid, _question_count integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _qids UUID[]; _session_id UUID; _per_q INT; _time_limit INT; _questions JSONB; _n INT;
  _existing RECORD;
  _elapsed INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  SELECT * INTO _existing FROM public.qb_exam_sessions
  WHERE user_id = _uid AND subject_id = _subject_id
    AND difficulty = _difficulty
    AND (topic_id IS NOT DISTINCT FROM _topic_id)
    AND submitted_at IS NULL
  ORDER BY started_at DESC LIMIT 1;

  IF _existing.id IS NOT NULL THEN
    _elapsed := EXTRACT(EPOCH FROM (now() - _existing.started_at))::INT;
    IF _elapsed < _existing.time_limit_seconds THEN
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'question_text', question_text, 'question_type', question_type,
        'options', options, 'points', points
      ) ORDER BY array_position(_existing.question_ids, id))
      INTO _questions FROM public.qb_questions WHERE id = ANY(_existing.question_ids);
      RETURN jsonb_build_object(
        'session_id', _existing.id, 'time_limit_seconds', _existing.time_limit_seconds,
        'total_questions', _existing.total_questions, 'questions', _questions,
        'resumed', true
      );
    END IF;
    UPDATE public.qb_exam_sessions SET status = 'expired', submitted_at = now()
      WHERE id = _existing.id AND submitted_at IS NULL;
  END IF;

  PERFORM public.qb_consume_tokens(5);

  SELECT ARRAY_AGG(id) INTO _qids FROM (
    SELECT id FROM public.qb_questions
    WHERE subject_id = _subject_id AND difficulty = _difficulty AND is_active = true
      AND (_topic_id IS NULL OR topic_id = _topic_id)
    ORDER BY random() LIMIT _question_count
  ) q;
  IF _qids IS NULL OR array_length(_qids, 1) < 1 THEN
    RAISE EXCEPTION 'No questions available for this selection';
  END IF;
  _n := array_length(_qids, 1);
  _per_q := CASE _difficulty WHEN 'basic' THEN 35 WHEN 'intermediate' THEN 42 WHEN 'advanced' THEN 49 END;
  _time_limit := GREATEST(_per_q * _n, 120);
  INSERT INTO public.qb_exam_sessions
    (user_id, subject_id, topic_id, difficulty, question_ids, total_questions, time_limit_seconds, total_points)
  VALUES (_uid, _subject_id, _topic_id, _difficulty, _qids, _n, _time_limit,
    (SELECT COALESCE(SUM(points),0) FROM public.qb_questions WHERE id = ANY(_qids)))
  RETURNING id INTO _session_id;
  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'question_text', question_text, 'question_type', question_type,
    'options', options, 'points', points
  ) ORDER BY array_position(_qids, id))
  INTO _questions FROM public.qb_questions WHERE id = ANY(_qids);
  RETURN jsonb_build_object(
    'session_id', _session_id, 'time_limit_seconds', _time_limit,
    'total_questions', _n, 'questions', _questions, 'resumed', false
  );
END $$;

CREATE OR REPLACE FUNCTION public.qb_start_mixed_exam(_difficulty qb_difficulty, _question_count integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _qids UUID[]; _session_id UUID; _time_limit INT; _questions JSONB; _per_subject INT; _active_count INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM public.qb_consume_tokens(10);

  SELECT COUNT(*) INTO _active_count FROM public.qb_subjects WHERE is_active = true;
  IF _active_count < 1 THEN RAISE EXCEPTION 'No active subjects'; END IF;
  _per_subject := GREATEST(1, CEIL(_question_count::numeric / _active_count)::INT);

  WITH picks AS (
    SELECT q.id, q.subject_id,
           row_number() OVER (PARTITION BY q.subject_id ORDER BY random()) AS rn
    FROM public.qb_questions q
    JOIN public.qb_subjects s ON s.id = q.subject_id AND s.is_active = true
    WHERE q.difficulty = _difficulty AND q.is_active = true
  )
  SELECT ARRAY_AGG(id) INTO _qids FROM (
    SELECT id FROM picks WHERE rn <= _per_subject ORDER BY random() LIMIT _question_count
  ) x;
  IF _qids IS NULL OR array_length(_qids, 1) < 1 THEN
    RAISE EXCEPTION 'No questions available for mixed exam';
  END IF;
  _time_limit := CASE _difficulty WHEN 'basic' THEN 1500 WHEN 'intermediate' THEN 1800 WHEN 'advanced' THEN 2100 END;
  INSERT INTO public.qb_exam_sessions
    (user_id, subject_id, topic_id, difficulty, question_ids, total_questions, time_limit_seconds, total_points)
  VALUES (_uid, NULL, NULL, _difficulty, _qids, array_length(_qids,1), _time_limit,
    (SELECT COALESCE(SUM(points),0) FROM public.qb_questions WHERE id = ANY(_qids)))
  RETURNING id INTO _session_id;
  UPDATE public.qb_questions SET times_used = times_used + 1 WHERE id = ANY(_qids);
  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'question_text', question_text, 'question_type', question_type,
    'options', options, 'points', points
  ) ORDER BY array_position(_qids, id))
  INTO _questions FROM public.qb_questions WHERE id = ANY(_qids);
  RETURN jsonb_build_object(
    'session_id', _session_id, 'time_limit_seconds', _time_limit,
    'total_questions', array_length(_qids,1), 'questions', _questions, 'mixed', true
  );
END $$;

CREATE OR REPLACE FUNCTION public.qb_submit_exam(_session_id uuid, _answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _session public.qb_exam_sessions%ROWTYPE;
  _score INT := 0; _correct_count INT := 0; _wrong_count INT := 0; _penalty INT := 0;
  _total_points INT; _percentage NUMERIC(5,2); _passed BOOLEAN; _time_taken INT;
  _xp INT := 0;
  _stats public.qb_user_stats%ROWTYPE;
  _today DATE := CURRENT_DATE; _new_streak INT;
  _new_badges JSONB := '[]'::jsonb;
  _badge RECORD; _is_perfect BOOLEAN; _is_speed BOOLEAN; _clean_focus BOOLEAN;
  _penalty_pct numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _session FROM public.qb_exam_sessions WHERE id = _session_id;
  IF _session.id IS NULL OR _session.user_id <> _uid THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF _session.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'Already submitted'; END IF;
  -- Ownership already verified above (against the real session row) --
  -- elevate now so the writes below succeed under the tightened policies.
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  _penalty_pct := CASE _session.difficulty WHEN 'basic' THEN 0.15 WHEN 'intermediate' THEN 0.20 WHEN 'advanced' THEN 0.25 ELSE 0 END;

  WITH ans AS (
    SELECT (e->>'question_id')::uuid AS qid,
           NULLIF(e->>'selected_answer','') AS selected,
           COALESCE((e->>'time_spent_seconds')::int, 0) AS tspent
    FROM jsonb_array_elements(_answers) e
  ),
  graded AS (
    SELECT a.qid, a.selected, a.tspent, q.points, q.question_type,
      CASE WHEN a.selected IS NULL THEN NULL
        WHEN q.question_type = 'short_answer'
          THEN lower(trim(a.selected)) = lower(trim(q.correct_answer))
        ELSE a.selected = q.correct_answer END AS is_correct,
      CASE WHEN a.selected IS NULL THEN 0
        WHEN (q.question_type = 'short_answer' AND lower(trim(a.selected)) = lower(trim(q.correct_answer)))
          OR (q.question_type <> 'short_answer' AND a.selected = q.correct_answer)
          THEN 0
        ELSE CEIL(q.points * _penalty_pct)::int END AS penalty
    FROM ans a JOIN public.qb_questions q ON q.id = a.qid
  ),
  ins AS (
    INSERT INTO public.qb_exam_answers (session_id, question_id, selected_answer, is_correct, time_spent_seconds, penalty_points)
    SELECT _session_id, qid, selected, COALESCE(is_correct,false), tspent, penalty FROM graded
    ON CONFLICT (session_id, question_id) DO UPDATE
      SET selected_answer = EXCLUDED.selected_answer,
          is_correct = EXCLUDED.is_correct,
          time_spent_seconds = EXCLUDED.time_spent_seconds,
          penalty_points = EXCLUDED.penalty_points
    RETURNING 1
  ),
  tot AS (
    SELECT
      COALESCE(SUM(CASE WHEN is_correct THEN points ELSE 0 END),0)::int AS s,
      COUNT(*) FILTER (WHERE is_correct)::int AS c,
      COUNT(*) FILTER (WHERE is_correct = false)::int AS w,
      COALESCE(SUM(penalty),0)::int AS p
    FROM graded
  )
  SELECT s, c, w, p INTO _score, _correct_count, _wrong_count, _penalty FROM tot;

  _total_points := COALESCE(_session.total_points, 0);
  _score := GREATEST(_score - _penalty, 0);
  _percentage := CASE WHEN _total_points > 0 THEN ROUND((_score::NUMERIC / _total_points) * 100, 2) ELSE 0 END;
  _passed := _percentage >= _session.pass_percentage;
  _time_taken := EXTRACT(EPOCH FROM (now() - _session.started_at))::INT;

  _xp := (_correct_count * 5) + CASE WHEN _passed THEN 25 ELSE 0 END
       + CASE WHEN _percentage >= 90 THEN 50 WHEN _percentage >= 75 THEN 20 ELSE 0 END;

  UPDATE public.qb_exam_sessions
    SET submitted_at = now(), time_taken_seconds = _time_taken,
        score = _score, percentage = _percentage, passed = _passed, status = 'completed', xp_earned = _xp
    WHERE id = _session_id;

  SELECT * INTO _stats FROM public.qb_user_stats WHERE user_id = _uid;
  IF _stats.user_id IS NULL THEN
    _new_streak := 1;
    INSERT INTO public.qb_user_stats (user_id, total_xp, current_streak, longest_streak, last_practice_date, exams_taken, exams_passed, perfect_scores)
    VALUES (_uid, _xp, _new_streak, _new_streak, _today, 1, CASE WHEN _passed THEN 1 ELSE 0 END, CASE WHEN _percentage = 100 THEN 1 ELSE 0 END);
    SELECT * INTO _stats FROM public.qb_user_stats WHERE user_id = _uid;
  ELSE
    IF _stats.last_practice_date = _today THEN _new_streak := _stats.current_streak;
    ELSIF _stats.last_practice_date = _today - INTERVAL '1 day' THEN _new_streak := _stats.current_streak + 1;
    ELSE _new_streak := 1; END IF;
    UPDATE public.qb_user_stats
      SET total_xp = total_xp + _xp, current_streak = _new_streak,
          longest_streak = GREATEST(longest_streak, _new_streak),
          last_practice_date = _today, exams_taken = exams_taken + 1,
          exams_passed = exams_passed + CASE WHEN _passed THEN 1 ELSE 0 END,
          perfect_scores = perfect_scores + CASE WHEN _percentage = 100 THEN 1 ELSE 0 END,
          updated_at = now()
      WHERE user_id = _uid RETURNING * INTO _stats;
  END IF;

  _is_perfect := _percentage = 100;
  _is_speed := _passed AND _percentage >= 80 AND _time_taken < (_session.time_limit_seconds / 2);
  _clean_focus := _session.focus_mode_used AND _session.violation_count = 0;

  FOR _badge IN
    SELECT b.* FROM public.qb_badges b
    WHERE b.is_active = true
      AND NOT EXISTS (SELECT 1 FROM public.qb_user_badges ub WHERE ub.user_id = _uid AND ub.badge_key = b.key)
  LOOP
    DECLARE _award BOOLEAN := false; _ctype TEXT; _cval INT;
    BEGIN
      _ctype := _badge.criteria->>'type';
      _cval := COALESCE((_badge.criteria->>'value')::INT, 0);
      IF _ctype = 'exams_taken' AND _stats.exams_taken >= _cval THEN _award := true;
      ELSIF _ctype = 'exams_passed' AND _stats.exams_passed >= _cval THEN _award := true;
      ELSIF _ctype = 'streak' AND _stats.current_streak >= _cval THEN _award := true;
      ELSIF _ctype = 'perfect_score' AND _is_perfect THEN _award := true;
      ELSIF _ctype = 'speed' AND _is_speed THEN _award := true;
      ELSIF _ctype = 'clean_focus' AND _clean_focus THEN _award := true;
      END IF;
      IF _award THEN
        INSERT INTO public.qb_user_badges (user_id, badge_key, session_id) VALUES (_uid, _badge.key, _session_id)
        ON CONFLICT DO NOTHING;
        _new_badges := _new_badges || jsonb_build_object('key', _badge.key, 'name', _badge.name, 'icon', _badge.icon, 'description', _badge.description, 'tier', _badge.tier);
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'session_id', _session_id, 'score', _score, 'total_points', _total_points,
    'correct_count', _correct_count, 'wrong_count', _wrong_count,
    'penalty_points', _penalty,
    'total_questions', _session.total_questions,
    'percentage', _percentage, 'passed', _passed, 'time_taken_seconds', _time_taken,
    'xp_earned', _xp, 'current_streak', _stats.current_streak, 'total_xp', _stats.total_xp,
    'new_badges', _new_badges
  );
END $$;
