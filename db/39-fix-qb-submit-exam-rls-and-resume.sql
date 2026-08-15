-- CRITICAL: qb_submit_exam() (called on every exam submission) INSERTs into
-- three tables under the caller's own GUC context (SECURITY DEFINER does
-- NOT change auth.uid()/auth.role() for our GUC-based RLS -- see db/37's
-- note). Two of the three had NO INSERT policy at all:
--   qb_user_stats  -- only had SELECT + UPDATE. Every student's FIRST-EVER
--                     exam submission hits the INSERT branch (no existing
--                     stats row yet) and hard-fails RLS, aborting the
--                     whole function -- including the qb_exam_answers
--                     insert that already happened in the same transaction.
--                     This is why "answer submit kora jay na" -- the entire
--                     submit silently rolled back for any real (non-seeded)
--                     student.
--   qb_user_badges -- only had SELECT. INSERT happens whenever a badge is
--                     newly earned; same rollback risk.
-- qb_exam_answers also had no UPDATE policy, needed for the
-- ON CONFLICT (session_id, question_id) DO UPDATE path (a student who
-- resumes and re-submits answers for the same session).
SELECT set_config('request.jwt.claim.role', 'service_role', false);

DROP POLICY IF EXISTS "users insert own stats" ON public.qb_user_stats;
CREATE POLICY "users insert own stats" ON public.qb_user_stats
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "users insert own badges" ON public.qb_user_badges;
CREATE POLICY "users insert own badges" ON public.qb_user_badges
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "qb_answers_own_update" ON public.qb_exam_answers;
CREATE POLICY "qb_answers_own_update" ON public.qb_exam_answers
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM public.qb_exam_sessions s WHERE s.id = qb_exam_answers.session_id AND s.user_id = auth.uid()
    ))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM public.qb_exam_sessions s WHERE s.id = qb_exam_answers.session_id AND s.user_id = auth.uid()
    ))
  );

-- ---------------------------------------------------------------------
-- Resume, not restart: qb_start_exam() previously always created a brand
-- new session and charged 5 tokens, with no check for an existing,
-- still-open (not submitted, not timed out) session for the same
-- user/subject/topic/difficulty. Reported symptom: a student who leaves
-- the exam page (closes tab, connection drops, navigates back) and clicks
-- "Start" again gets a fresh exam instead of resuming -- losing progress
-- and paying tokens twice for what should be one attempt.
CREATE OR REPLACE FUNCTION public.qb_start_exam(_subject_id uuid, _difficulty qb_difficulty, _topic_id uuid DEFAULT NULL::uuid, _question_count integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _qids UUID[]; _session_id UUID; _per_q INT; _time_limit INT; _questions JSONB; _n INT;
  _existing RECORD;
  _elapsed INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Resume an already-open, not-yet-expired session for this exact
  -- subject/topic/difficulty instead of charging tokens for a new one.
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
    -- Expired and never submitted -- close it out so it stops blocking new attempts.
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
END $function$;
