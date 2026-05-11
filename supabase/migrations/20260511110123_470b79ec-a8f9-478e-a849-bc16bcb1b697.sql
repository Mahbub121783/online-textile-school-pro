
-- 1. Alter qb_exam_sessions
ALTER TABLE public.qb_exam_sessions
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS violation_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS focus_mode_used BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resume_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xp_earned INT NOT NULL DEFAULT 0;

-- 2. qb_exam_violations
CREATE TABLE IF NOT EXISTS public.qb_exam_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.qb_exam_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qb_violations_session ON public.qb_exam_violations(session_id);
CREATE INDEX IF NOT EXISTS idx_qb_violations_user ON public.qb_exam_violations(user_id);
ALTER TABLE public.qb_exam_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own violations" ON public.qb_exam_violations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own violations" ON public.qb_exam_violations
  FOR SELECT USING (auth.uid() = user_id OR public.qb_is_staff(auth.uid()));

-- 3. qb_user_stats
CREATE TABLE IF NOT EXISTS public.qb_user_stats (
  user_id UUID PRIMARY KEY,
  total_xp INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_practice_date DATE,
  exams_taken INT NOT NULL DEFAULT 0,
  exams_passed INT NOT NULL DEFAULT 0,
  perfect_scores INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.qb_user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read user stats" ON public.qb_user_stats FOR SELECT USING (true);
CREATE POLICY "Users update own stats" ON public.qb_user_stats FOR UPDATE USING (auth.uid() = user_id);

-- 4. qb_badges + qb_user_badges
CREATE TABLE IF NOT EXISTS public.qb_badges (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'bronze',
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.qb_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read badges" ON public.qb_badges FOR SELECT USING (true);
CREATE POLICY "Admins manage badges" ON public.qb_badges FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE IF NOT EXISTS public.qb_user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_key TEXT NOT NULL REFERENCES public.qb_badges(key) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id UUID REFERENCES public.qb_exam_sessions(id) ON DELETE SET NULL,
  UNIQUE (user_id, badge_key)
);
ALTER TABLE public.qb_user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read user badges" ON public.qb_user_badges FOR SELECT USING (true);

-- Seed badges
INSERT INTO public.qb_badges (key, name, description, icon, tier, criteria, sort_order) VALUES
  ('first_step', 'First Step', 'Complete your first practice exam', '🎯', 'bronze', '{"type":"exams_taken","value":1}', 1),
  ('warrior', 'Warrior', 'Complete 10 practice exams', '⚔️', 'silver', '{"type":"exams_taken","value":10}', 2),
  ('veteran', 'Veteran', 'Complete 50 practice exams', '🛡️', 'gold', '{"type":"exams_taken","value":50}', 3),
  ('perfectionist', 'Perfectionist', 'Score 100% on a practice exam', '💎', 'gold', '{"type":"perfect_score"}', 4),
  ('speed_demon', 'Speed Demon', 'Finish an exam in under half the time limit with >80% score', '⚡', 'silver', '{"type":"speed"}', 5),
  ('streak_3', 'On Fire', 'Practice 3 days in a row', '🔥', 'bronze', '{"type":"streak","value":3}', 6),
  ('streak_7', 'Dedicated', 'Practice 7 days in a row', '🔥', 'silver', '{"type":"streak","value":7}', 7),
  ('streak_30', 'Unstoppable', 'Practice 30 days in a row', '🔥', 'gold', '{"type":"streak","value":30}', 8),
  ('honest_player', 'Honest Player', 'Complete an exam in focus mode with zero violations', '🛡️', 'silver', '{"type":"clean_focus"}', 9),
  ('high_achiever', 'High Achiever', 'Pass 25 exams', '🏆', 'gold', '{"type":"exams_passed","value":25}', 10)
ON CONFLICT (key) DO NOTHING;

-- 5. RPC: qb_log_violation
CREATE OR REPLACE FUNCTION public.qb_log_violation(_session_id UUID, _type TEXT, _metadata JSONB DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.qb_exam_sessions WHERE id = _session_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  INSERT INTO public.qb_exam_violations (session_id, user_id, type, metadata)
  VALUES (_session_id, _uid, _type, COALESCE(_metadata, '{}'::jsonb));
  UPDATE public.qb_exam_sessions
    SET violation_count = violation_count + 1,
        resume_count = CASE WHEN _type = 'session_resumed' THEN resume_count + 1 ELSE resume_count END,
        focus_mode_used = CASE WHEN _type = 'focus_mode_entered' THEN true ELSE focus_mode_used END
    WHERE id = _session_id;
END $$;

-- 6. RPC: qb_heartbeat
CREATE OR REPLACE FUNCTION public.qb_heartbeat(_session_id UUID)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.qb_exam_sessions
    SET last_heartbeat_at = now()
    WHERE id = _session_id AND user_id = auth.uid() AND submitted_at IS NULL;
$$;

-- 7. Update qb_submit_exam to award XP, update streak, award badges
CREATE OR REPLACE FUNCTION public.qb_submit_exam(_session_id uuid, _answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid UUID := auth.uid();
  _session public.qb_exam_sessions%ROWTYPE;
  _ans JSONB; _qid UUID; _selected TEXT; _tspent INT;
  _correct TEXT; _qtype public.qb_question_type; _is_correct BOOLEAN; _qpoints INT;
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

  -- XP: 5 per correct + bonus
  _xp := (_correct_count * 5) + CASE WHEN _passed THEN 25 ELSE 0 END
       + CASE WHEN _percentage >= 90 THEN 50 WHEN _percentage >= 75 THEN 20 ELSE 0 END;

  UPDATE public.qb_exam_sessions
    SET submitted_at = now(), time_taken_seconds = _time_taken,
        score = _score, percentage = _percentage, passed = _passed, status = 'completed',
        xp_earned = _xp
    WHERE id = _session_id;

  -- Upsert user stats with streak logic
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

  -- Badge evaluation
  _is_perfect := _percentage = 100;
  _is_speed := _passed AND _percentage >= 80 AND _time_taken < (_session.time_limit_seconds / 2);
  _clean_focus := _session.focus_mode_used AND _session.violation_count = 0;

  FOR _badge IN SELECT * FROM public.qb_badges WHERE is_active = true LOOP
    -- skip if already earned
    IF EXISTS (SELECT 1 FROM public.qb_user_badges WHERE user_id = _uid AND badge_key = _badge.key) THEN
      CONTINUE;
    END IF;
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
END $$;
