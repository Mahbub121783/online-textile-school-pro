
-- 1. negative marking column
ALTER TABLE public.qb_exam_answers ADD COLUMN IF NOT EXISTS penalty_points integer NOT NULL DEFAULT 0;

-- 2. token table (1 row / user) + ledger
CREATE TABLE IF NOT EXISTS public.qb_user_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_balance integer NOT NULL DEFAULT 20,
  paid_balance integer NOT NULL DEFAULT 0,
  last_refill_date date NOT NULL DEFAULT CURRENT_DATE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qb_user_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own tokens" ON public.qb_user_tokens;
CREATE POLICY "users read own tokens" ON public.qb_user_tokens
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.qb_token_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  ref_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qb_token_ledger_user_idx ON public.qb_token_ledger(user_id, created_at DESC);
ALTER TABLE public.qb_token_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own ledger" ON public.qb_token_ledger;
CREATE POLICY "users read own ledger" ON public.qb_token_ledger
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 3. token status (lazy refill view)
CREATE OR REPLACE FUNCTION public.qb_get_token_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.qb_user_tokens%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
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

-- 4. consume tokens atomically (daily first, then paid)
CREATE OR REPLACE FUNCTION public.qb_consume_tokens(_cost integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _avail int;
  _take_daily int;
  _take_paid int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.qb_is_staff(_uid) THEN RETURN; END IF;

  -- ensure row + refill
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

-- 5. credit paid tokens (called from checkout)
CREATE OR REPLACE FUNCTION public.qb_credit_paid_tokens(_credits integer, _order_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _credits <= 0 THEN RETURN; END IF;
  INSERT INTO public.qb_user_tokens(user_id, daily_balance, paid_balance, last_refill_date)
  VALUES (_uid, 20, _credits, CURRENT_DATE)
  ON CONFLICT (user_id) DO UPDATE SET paid_balance = public.qb_user_tokens.paid_balance + _credits, updated_at = now();
  INSERT INTO public.qb_token_ledger(user_id, delta, reason, ref_id)
  VALUES (_uid, _credits, 'purchase', _order_id);
END $$;

-- 6. start exam: consume tokens BEFORE creating session
CREATE OR REPLACE FUNCTION public.qb_start_exam(_subject_id uuid, _difficulty qb_difficulty, _topic_id uuid DEFAULT NULL, _question_count integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _qids UUID[]; _session_id UUID; _per_q INT; _time_limit INT; _questions JSONB; _n INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
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
    'total_questions', _n, 'questions', _questions
  );
END $$;

-- 7. start mixed exam: consume 10 tokens
CREATE OR REPLACE FUNCTION public.qb_start_mixed_exam(_difficulty qb_difficulty, _question_count integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _qids UUID[]; _session_id UUID; _time_limit INT; _questions JSONB; _per_subject INT; _active_count INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
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

-- 8. submit exam with negative marking
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

-- Tighten EXECUTE on new RPCs
REVOKE EXECUTE ON FUNCTION public.qb_consume_tokens(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.qb_credit_paid_tokens(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qb_consume_tokens(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qb_credit_paid_tokens(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qb_get_token_status() TO authenticated;
