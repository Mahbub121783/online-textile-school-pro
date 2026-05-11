
CREATE TYPE public.qb_difficulty AS ENUM ('basic', 'intermediate', 'advanced');
CREATE TYPE public.qb_question_type AS ENUM ('multiple_choice', 'true_false', 'short_answer');
CREATE TYPE public.qb_question_source AS ENUM ('manual', 'bulk', 'ai');
CREATE TYPE public.qb_leaderboard_period AS ENUM ('all_time', 'monthly', 'weekly');

CREATE TABLE public.qb_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.qb_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.qb_subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, slug)
);

CREATE TABLE public.qb_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.qb_subjects(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.qb_topics(id) ON DELETE SET NULL,
  difficulty public.qb_difficulty NOT NULL DEFAULT 'basic',
  question_type public.qb_question_type NOT NULL DEFAULT 'multiple_choice',
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  points INT NOT NULL DEFAULT 1,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source public.qb_question_source NOT NULL DEFAULT 'manual',
  created_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  times_used INT NOT NULL DEFAULT 0,
  times_correct INT NOT NULL DEFAULT 0,
  correct_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_qb_questions_pick ON public.qb_questions(subject_id, difficulty, is_active);
CREATE INDEX idx_qb_questions_topic ON public.qb_questions(topic_id);

CREATE TABLE public.qb_exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject_id UUID NOT NULL REFERENCES public.qb_subjects(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.qb_topics(id) ON DELETE SET NULL,
  difficulty public.qb_difficulty NOT NULL,
  question_ids UUID[] NOT NULL,
  total_questions INT NOT NULL DEFAULT 25,
  time_limit_seconds INT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  time_taken_seconds INT,
  score INT NOT NULL DEFAULT 0,
  total_points INT NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  pass_percentage INT NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_qb_sessions_user ON public.qb_exam_sessions(user_id, submitted_at DESC);
CREATE INDEX idx_qb_sessions_leaderboard ON public.qb_exam_sessions(subject_id, difficulty, percentage DESC);

CREATE TABLE public.qb_exam_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.qb_exam_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.qb_questions(id) ON DELETE CASCADE,
  selected_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  time_spent_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id)
);

CREATE TABLE public.qb_leaderboard_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  period public.qb_leaderboard_period NOT NULL,
  subject_id UUID REFERENCES public.qb_subjects(id) ON DELETE CASCADE,
  total_exams INT NOT NULL DEFAULT 0,
  total_passed INT NOT NULL DEFAULT 0,
  avg_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_points INT NOT NULL DEFAULT 0,
  rank INT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period, subject_id)
);
CREATE INDEX idx_qb_lb_rank ON public.qb_leaderboard_cache(period, subject_id, total_points DESC);

CREATE TRIGGER trg_qb_subjects_updated BEFORE UPDATE ON public.qb_subjects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_qb_topics_updated BEFORE UPDATE ON public.qb_topics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_qb_questions_updated BEFORE UPDATE ON public.qb_questions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.qb_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qb_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qb_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qb_exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qb_exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qb_leaderboard_cache ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.qb_is_staff(_uid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('admin','super_admin','instructor')
  );
$$;

CREATE POLICY "qb_subjects_public_read" ON public.qb_subjects FOR SELECT USING (is_active OR public.qb_is_staff(auth.uid()));
CREATE POLICY "qb_subjects_staff_manage" ON public.qb_subjects FOR ALL USING (public.qb_is_staff(auth.uid())) WITH CHECK (public.qb_is_staff(auth.uid()));

CREATE POLICY "qb_topics_public_read" ON public.qb_topics FOR SELECT USING (is_active OR public.qb_is_staff(auth.uid()));
CREATE POLICY "qb_topics_staff_manage" ON public.qb_topics FOR ALL USING (public.qb_is_staff(auth.uid())) WITH CHECK (public.qb_is_staff(auth.uid()));

CREATE POLICY "qb_questions_auth_read" ON public.qb_questions FOR SELECT USING ((auth.uid() IS NOT NULL AND is_active) OR public.qb_is_staff(auth.uid()));
CREATE POLICY "qb_questions_staff_manage" ON public.qb_questions FOR ALL USING (public.qb_is_staff(auth.uid())) WITH CHECK (public.qb_is_staff(auth.uid()));

CREATE POLICY "qb_sessions_own_read" ON public.qb_exam_sessions FOR SELECT USING (auth.uid() = user_id OR public.qb_is_staff(auth.uid()));
CREATE POLICY "qb_sessions_own_insert" ON public.qb_exam_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "qb_sessions_own_update" ON public.qb_exam_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "qb_answers_own_read" ON public.qb_exam_answers FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.qb_exam_sessions s WHERE s.id = session_id AND (s.user_id = auth.uid() OR public.qb_is_staff(auth.uid())))
);
CREATE POLICY "qb_answers_own_write" ON public.qb_exam_answers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.qb_exam_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);

CREATE POLICY "qb_lb_public_read" ON public.qb_leaderboard_cache FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.qb_start_exam(
  _subject_id UUID, _difficulty public.qb_difficulty, _topic_id UUID DEFAULT NULL, _question_count INT DEFAULT 25
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  _time_limit := CASE _difficulty WHEN 'basic' THEN 1200 WHEN 'intermediate' THEN 1500 WHEN 'advanced' THEN 1800 END;

  INSERT INTO public.qb_exam_sessions
    (user_id, subject_id, topic_id, difficulty, question_ids, total_questions, time_limit_seconds, total_points)
  VALUES (_uid, _subject_id, _topic_id, _difficulty, _qids, array_length(_qids,1), _time_limit,
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
    'total_questions', array_length(_qids,1), 'questions', _questions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.qb_submit_exam(_session_id UUID, _answers JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _session public.qb_exam_sessions%ROWTYPE;
  _ans JSONB; _qid UUID; _selected TEXT; _tspent INT;
  _correct TEXT; _qtype public.qb_question_type; _is_correct BOOLEAN; _qpoints INT;
  _score INT := 0; _correct_count INT := 0; _total_points INT;
  _percentage NUMERIC(5,2); _passed BOOLEAN; _time_taken INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _session FROM public.qb_exam_sessions WHERE id = _session_id;
  IF _session.id IS NULL OR _session.user_id <> _uid THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF _session.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'Already submitted'; END IF;

  FOR _ans IN SELECT * FROM jsonb_array_elements(_answers) LOOP
    _qid := (_ans->>'question_id')::UUID;
    _selected := _ans->>'selected_answer';
    _tspent := COALESCE((_ans->>'time_spent_seconds')::INT, 0);

    SELECT correct_answer, question_type, points INTO _correct, _qtype, _qpoints
      FROM public.qb_questions WHERE id = _qid;
    IF _correct IS NULL THEN CONTINUE; END IF;

    IF _qtype = 'short_answer' THEN
      _is_correct := lower(trim(COALESCE(_selected,''))) = lower(trim(_correct));
    ELSE
      _is_correct := COALESCE(_selected,'') = _correct;
    END IF;

    IF _is_correct THEN
      _score := _score + _qpoints;
      _correct_count := _correct_count + 1;
      UPDATE public.qb_questions
        SET times_correct = times_correct + 1,
            correct_rate = ROUND(((times_correct + 1)::NUMERIC / NULLIF(times_used,0)) * 100, 2)
        WHERE id = _qid;
    END IF;

    INSERT INTO public.qb_exam_answers (session_id, question_id, selected_answer, is_correct, time_spent_seconds)
    VALUES (_session_id, _qid, _selected, _is_correct, _tspent)
    ON CONFLICT (session_id, question_id) DO UPDATE
      SET selected_answer = EXCLUDED.selected_answer,
          is_correct = EXCLUDED.is_correct,
          time_spent_seconds = EXCLUDED.time_spent_seconds;
  END LOOP;

  _total_points := COALESCE(_session.total_points, 0);
  _percentage := CASE WHEN _total_points > 0 THEN ROUND((_score::NUMERIC / _total_points) * 100, 2) ELSE 0 END;
  _passed := _percentage >= _session.pass_percentage;
  _time_taken := EXTRACT(EPOCH FROM (now() - _session.started_at))::INT;

  UPDATE public.qb_exam_sessions
    SET submitted_at = now(), time_taken_seconds = _time_taken,
        score = _score, percentage = _percentage, passed = _passed, status = 'completed'
    WHERE id = _session_id;

  RETURN jsonb_build_object(
    'session_id', _session_id, 'score', _score, 'total_points', _total_points,
    'correct_count', _correct_count, 'total_questions', _session.total_questions,
    'percentage', _percentage, 'passed', _passed, 'time_taken_seconds', _time_taken
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.qb_get_session_result(_session_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _session public.qb_exam_sessions%ROWTYPE;
  _result JSONB;
BEGIN
  SELECT * INTO _session FROM public.qb_exam_sessions WHERE id = _session_id;
  IF _session.id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF _session.user_id <> _uid AND NOT public.qb_is_staff(_uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _session.submitted_at IS NULL THEN RAISE EXCEPTION 'Not submitted'; END IF;

  SELECT jsonb_build_object(
    'session', to_jsonb(_session),
    'subject', (SELECT to_jsonb(s) FROM public.qb_subjects s WHERE s.id = _session.subject_id),
    'questions', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.id, 'question_text', q.question_text, 'question_type', q.question_type,
        'options', q.options, 'correct_answer', q.correct_answer, 'explanation', q.explanation,
        'points', q.points, 'selected_answer', a.selected_answer,
        'is_correct', a.is_correct, 'time_spent_seconds', a.time_spent_seconds
      ) ORDER BY array_position(_session.question_ids, q.id))
      FROM public.qb_questions q
      LEFT JOIN public.qb_exam_answers a ON a.question_id = q.id AND a.session_id = _session_id
      WHERE q.id = ANY(_session.question_ids)
    )
  ) INTO _result;
  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.qb_refresh_leaderboard()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.qb_leaderboard_cache;
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'all_time'::qb_leaderboard_period, NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
    ROUND(AVG(percentage)::NUMERIC, 2), SUM(score), RANK() OVER (ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL GROUP BY user_id;

  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'monthly', NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
    ROUND(AVG(percentage)::NUMERIC, 2), SUM(score), RANK() OVER (ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND submitted_at >= date_trunc('month', now()) GROUP BY user_id;

  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'weekly', NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
    ROUND(AVG(percentage)::NUMERIC, 2), SUM(score), RANK() OVER (ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND submitted_at >= date_trunc('week', now()) GROUP BY user_id;

  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'all_time', subject_id, COUNT(*), COUNT(*) FILTER (WHERE passed),
    ROUND(AVG(percentage)::NUMERIC, 2), SUM(score), RANK() OVER (PARTITION BY subject_id ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL GROUP BY user_id, subject_id;
END;
$$;
