
-- Phase 1: Remove per-question write hotspots from qb_start_exam and qb_submit_exam
CREATE OR REPLACE FUNCTION public.qb_start_exam(_subject_id uuid, _difficulty qb_difficulty, _topic_id uuid DEFAULT NULL::uuid, _question_count integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _qids UUID[];
  _session_id UUID;
  _time_limit INT;
  _questions JSONB;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT ARRAY_AGG(id) INTO _qids FROM (
    SELECT id FROM public.qb_questions
    WHERE subject_id = _subject_id AND difficulty = _difficulty AND is_active = true
      AND (_topic_id IS NULL OR topic_id = _topic_id)
    ORDER BY random() LIMIT _question_count
  ) q;
  IF _qids IS NULL OR array_length(_qids, 1) < 1 THEN
    RAISE EXCEPTION 'No questions available for this selection';
  END IF;
  _time_limit := CASE _difficulty WHEN 'basic' THEN 1500 WHEN 'intermediate' THEN 1800 WHEN 'advanced' THEN 2100 END;
  INSERT INTO public.qb_exam_sessions
    (user_id, subject_id, topic_id, difficulty, question_ids, total_questions, time_limit_seconds, total_points)
  VALUES (_uid, _subject_id, _topic_id, _difficulty, _qids, array_length(_qids,1), _time_limit,
    (SELECT COALESCE(SUM(points),0) FROM public.qb_questions WHERE id = ANY(_qids)))
  RETURNING id INTO _session_id;
  -- REMOVED: per-question times_used UPDATE (write hotspot). Nightly aggregator rebuilds stats.
  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'question_text', question_text, 'question_type', question_type,
    'options', options, 'points', points
  ) ORDER BY array_position(_qids, id))
  INTO _questions FROM public.qb_questions WHERE id = ANY(_qids);
  RETURN jsonb_build_object(
    'session_id', _session_id, 'time_limit_seconds', _time_limit,
    'total_questions', array_length(_qids,1), 'questions', _questions
  );
END;
$function$;

-- Batched submit: single INSERT for all answers, no per-question UPDATE
CREATE OR REPLACE FUNCTION public.qb_submit_exam(_session_id uuid, _answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _session public.qb_exam_sessions%ROWTYPE;
  _score INT := 0; _correct_count INT := 0; _total_points INT;
  _percentage NUMERIC(5,2); _passed BOOLEAN; _time_taken INT;
  _xp INT := 0;
  _stats public.qb_user_stats%ROWTYPE;
  _today DATE := CURRENT_DATE;
  _new_streak INT;
  _new_badges JSONB := '[]'::jsonb;
  _badge RECORD;
  _is_perfect BOOLEAN;
  _is_speed BOOLEAN;
  _clean_focus BOOLEAN;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _session FROM public.qb_exam_sessions WHERE id = _session_id;
  IF _session.id IS NULL OR _session.user_id <> _uid THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF _session.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'Already submitted'; END IF;

  -- Batched insert: compute correctness in a single set-based statement, no per-row UPDATE to qb_questions
  WITH ans AS (
    SELECT
      (e->>'question_id')::uuid AS qid,
      NULLIF(e->>'selected_answer','') AS selected,
      COALESCE((e->>'time_spent_seconds')::int, 0) AS tspent
    FROM jsonb_array_elements(_answers) e
  ),
  graded AS (
    SELECT
      a.qid, a.selected, a.tspent, q.points, q.question_type,
      CASE
        WHEN q.question_type = 'short_answer'
          THEN lower(trim(COALESCE(a.selected,''))) = lower(trim(q.correct_answer))
        ELSE COALESCE(a.selected,'') = q.correct_answer
      END AS is_correct
    FROM ans a JOIN public.qb_questions q ON q.id = a.qid
  ),
  ins AS (
    INSERT INTO public.qb_exam_answers (session_id, question_id, selected_answer, is_correct, time_spent_seconds)
    SELECT _session_id, qid, selected, is_correct, tspent FROM graded
    ON CONFLICT (session_id, question_id) DO UPDATE
      SET selected_answer = EXCLUDED.selected_answer,
          is_correct = EXCLUDED.is_correct,
          time_spent_seconds = EXCLUDED.time_spent_seconds
    RETURNING is_correct
  ),
  tot AS (
    SELECT
      COALESCE(SUM(CASE WHEN is_correct THEN points ELSE 0 END), 0)::int AS score,
      COUNT(*) FILTER (WHERE is_correct)::int AS correct_count
    FROM graded
  )
  SELECT score, correct_count INTO _score, _correct_count FROM tot;

  _total_points := COALESCE(_session.total_points, 0);
  _percentage := CASE WHEN _total_points > 0 THEN ROUND((_score::NUMERIC / _total_points) * 100, 2) ELSE 0 END;
  _passed := _percentage >= _session.pass_percentage;
  _time_taken := EXTRACT(EPOCH FROM (now() - _session.started_at))::INT;

  _xp := (_correct_count * 5) + CASE WHEN _passed THEN 25 ELSE 0 END
       + CASE WHEN _percentage >= 90 THEN 50 WHEN _percentage >= 75 THEN 20 ELSE 0 END;

  UPDATE public.qb_exam_sessions
    SET submitted_at = now(), time_taken_seconds = _time_taken,
        score = _score, percentage = _percentage, passed = _passed, status = 'completed',
        xp_earned = _xp
    WHERE id = _session_id;

  SELECT * INTO _stats FROM public.qb_user_stats WHERE user_id = _uid;
  IF _stats.user_id IS NULL THEN
    _new_streak := 1;
    INSERT INTO public.qb_user_stats (user_id, total_xp, current_streak, longest_streak, last_practice_date, exams_taken, exams_passed, perfect_scores)
    VALUES (_uid, _xp, _new_streak, _new_streak, _today, 1, CASE WHEN _passed THEN 1 ELSE 0 END, CASE WHEN _percentage = 100 THEN 1 ELSE 0 END);
    SELECT * INTO _stats FROM public.qb_user_stats WHERE user_id = _uid;
  ELSE
    IF _stats.last_practice_date = _today THEN
      _new_streak := _stats.current_streak;
    ELSIF _stats.last_practice_date = _today - INTERVAL '1 day' THEN
      _new_streak := _stats.current_streak + 1;
    ELSE
      _new_streak := 1;
    END IF;
    UPDATE public.qb_user_stats
      SET total_xp = total_xp + _xp,
          current_streak = _new_streak,
          longest_streak = GREATEST(longest_streak, _new_streak),
          last_practice_date = _today,
          exams_taken = exams_taken + 1,
          exams_passed = exams_passed + CASE WHEN _passed THEN 1 ELSE 0 END,
          perfect_scores = perfect_scores + CASE WHEN _percentage = 100 THEN 1 ELSE 0 END,
          updated_at = now()
      WHERE user_id = _uid
      RETURNING * INTO _stats;
  END IF;

  _is_perfect := _percentage = 100;
  _is_speed := _passed AND _percentage >= 80 AND _time_taken < (_session.time_limit_seconds / 2);
  _clean_focus := _session.focus_mode_used AND _session.violation_count = 0;

  -- Badge loop: only iterate badges NOT yet earned (single anti-join)
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
    'correct_count', _correct_count, 'total_questions', _session.total_questions,
    'percentage', _percentage, 'passed', _passed, 'time_taken_seconds', _time_taken,
    'xp_earned', _xp, 'current_streak', _stats.current_streak, 'total_xp', _stats.total_xp,
    'new_badges', _new_badges
  );
END $function$;

-- Batched integrity logging: accept array of events in a single call
CREATE OR REPLACE FUNCTION public.qb_log_violations_batch(_session_id uuid, _events jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid UUID := auth.uid(); _has_resume BOOLEAN; _has_focus BOOLEAN; _added INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.qb_exam_sessions WHERE id = _session_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
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
END $function$;

-- Nightly aggregator: rebuilds question usage stats from answers
CREATE OR REPLACE FUNCTION public.qb_aggregate_question_stats()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  WITH used AS (
    SELECT unnest(question_ids) AS qid, count(*) AS uses
    FROM public.qb_exam_sessions
    WHERE submitted_at IS NOT NULL
    GROUP BY 1
  ),
  correct AS (
    SELECT question_id AS qid, count(*) FILTER (WHERE is_correct) AS c
    FROM public.qb_exam_answers GROUP BY 1
  )
  UPDATE public.qb_questions q
     SET times_used = COALESCE(u.uses, 0),
         times_correct = COALESCE(c.c, 0),
         correct_rate = CASE WHEN COALESCE(u.uses,0) > 0
                             THEN ROUND((COALESCE(c.c,0)::numeric / u.uses) * 100, 2)
                             ELSE 0 END
    FROM (SELECT q2.id FROM public.qb_questions q2) qq
    LEFT JOIN used u ON u.qid = qq.id
    LEFT JOIN correct c ON c.qid = qq.id
   WHERE q.id = qq.id;
END $function$;

-- Auto-close orphan sessions (heartbeat dead > 15 min, not submitted)
CREATE OR REPLACE FUNCTION public.qb_auto_close_orphans()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _closed INT := 0;
BEGIN
  WITH dead AS (
    SELECT id FROM public.qb_exam_sessions
    WHERE submitted_at IS NULL
      AND (
        (last_heartbeat_at IS NOT NULL AND last_heartbeat_at < now() - interval '15 minutes')
        OR (last_heartbeat_at IS NULL AND started_at < now() - interval '1 hour')
      )
  ),
  upd AS (
    UPDATE public.qb_exam_sessions s
       SET submitted_at = now(),
           status = 'completed',
           passed = false,
           percentage = COALESCE(
             (SELECT ROUND((COUNT(*) FILTER (WHERE a.is_correct)::numeric / NULLIF(s.total_questions,0)) * 100, 2)
              FROM public.qb_exam_answers a WHERE a.session_id = s.id), 0),
           time_taken_seconds = EXTRACT(EPOCH FROM (now() - s.started_at))::int
     WHERE s.id IN (SELECT id FROM dead)
     RETURNING 1
  )
  SELECT COUNT(*) INTO _closed FROM upd;
  RETURN _closed;
END $function$;
