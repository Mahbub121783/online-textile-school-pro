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
  _per_q INT;
  _time_limit INT;
  _questions JSONB;
  _n INT;
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
  _n := array_length(_qids, 1);
  -- 30% reduction: per-question seconds scaled by difficulty (was ~60s/q at intermediate)
  _per_q := CASE _difficulty
              WHEN 'basic' THEN 35          -- was 50s
              WHEN 'intermediate' THEN 42   -- was 60s
              WHEN 'advanced' THEN 49       -- was 70s
            END;
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
    'total_questions', _n, 'questions', _questions
  );
END;
$function$;