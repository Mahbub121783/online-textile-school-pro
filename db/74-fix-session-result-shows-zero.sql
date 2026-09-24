-- CRITICAL: qb_get_session_result is SECURITY DEFINER but never elevated to
-- service_role before reading qb_questions, which has been staff-only-read
-- RLS since db/58 ("qb_questions_staff_read": service_role OR qb_is_staff()).
-- For every normal (non-staff) student, the LEFT JOIN against qb_questions
-- returns zero rows under RLS, so jsonb_agg(...) is NULL, the frontend's
-- `questions` array is empty, and the result page shows "0 of 0 correct"
-- regardless of how the student actually did -- affecting every student's
-- every exam result, not a transient/edge case.
CREATE OR REPLACE FUNCTION public.qb_get_session_result(_session_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _session public.qb_exam_sessions%ROWTYPE;
  _result JSONB;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _session FROM public.qb_exam_sessions WHERE id = _session_id;
  IF _session.id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF _session.user_id <> _uid AND NOT public.qb_is_staff(_uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _session.submitted_at IS NULL THEN RAISE EXCEPTION 'Not submitted'; END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  SELECT jsonb_build_object(
    'session', to_jsonb(_session),
    'subject', (SELECT to_jsonb(s) FROM public.qb_subjects s WHERE s.id = _session.subject_id),
    'questions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', q.id, 'question_text', q.question_text, 'question_type', q.question_type,
        'options', q.options, 'correct_answer', q.correct_answer, 'explanation', q.explanation,
        'points', q.points, 'selected_answer', a.selected_answer,
        'is_correct', a.is_correct, 'time_spent_seconds', a.time_spent_seconds,
        'penalty_points', a.penalty_points
      ) ORDER BY array_position(_session.question_ids, q.id)), '[]'::jsonb)
      FROM public.qb_questions q
      LEFT JOIN public.qb_exam_answers a ON a.question_id = q.id AND a.session_id = _session_id
      WHERE q.id = ANY(_session.question_ids)
    )
  ) INTO _result;
  RETURN _result;
END;
$$;
