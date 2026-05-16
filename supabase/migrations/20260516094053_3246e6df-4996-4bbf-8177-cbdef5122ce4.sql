
-- 1. Insert 4 new departments
INSERT INTO public.qb_subjects (id, name, slug, description, icon, color, sort_order, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Yarn', 'yarn', 'Yarn engineering, technology & spinning', '🧶', '#0F766E', 1, true),
  ('22222222-2222-2222-2222-222222222222', 'Fabric Manufacturing', 'fabric', 'Weaving & knitting fabric production', '🧵', '#B45309', 2, true),
  ('33333333-3333-3333-3333-333333333333', 'Wet Processing', 'wet', 'Dyeing, printing & finishing', '💧', '#0369A1', 3, true),
  ('44444444-4444-4444-4444-444444444444', 'Apparel & Management', 'apparel', 'Garments, merchandising, QC & textile management', '👔', '#9333EA', 4, true)
ON CONFLICT (id) DO NOTHING;

-- 2. Remap questions
UPDATE public.qb_questions SET subject_id = '11111111-1111-1111-1111-111111111111'
  WHERE subject_id IN ('2f14b43b-2713-4f1e-b284-58c5597166d3','11dc4603-b32e-424b-920a-0c2f13c5b3ff','73246f68-0d3c-45d4-95f5-07698eb47537');
UPDATE public.qb_questions SET subject_id = '22222222-2222-2222-2222-222222222222'
  WHERE subject_id IN ('28c4dffd-2bb6-4453-8254-12154945ebf7','17f9d89c-c880-4727-af03-d5dcbb3e93a2');
UPDATE public.qb_questions SET subject_id = '33333333-3333-3333-3333-333333333333'
  WHERE subject_id = '2958e3c8-ab45-4ea5-a48f-86ae843eb336';
UPDATE public.qb_questions SET subject_id = '44444444-4444-4444-4444-444444444444'
  WHERE subject_id IN ('fc8f4df4-01e7-473e-a976-a0a64e431164','c3b63be5-f7bf-41cf-a7b7-af65bed75214','894be49f-36bd-40b9-bc86-050733c1946f','41953c02-00c0-41e5-8a06-dba022a52b49');

-- 3. Remap exam sessions
UPDATE public.qb_exam_sessions SET subject_id = '11111111-1111-1111-1111-111111111111'
  WHERE subject_id IN ('2f14b43b-2713-4f1e-b284-58c5597166d3','11dc4603-b32e-424b-920a-0c2f13c5b3ff','73246f68-0d3c-45d4-95f5-07698eb47537');
UPDATE public.qb_exam_sessions SET subject_id = '22222222-2222-2222-2222-222222222222'
  WHERE subject_id IN ('28c4dffd-2bb6-4453-8254-12154945ebf7','17f9d89c-c880-4727-af03-d5dcbb3e93a2');
UPDATE public.qb_exam_sessions SET subject_id = '33333333-3333-3333-3333-333333333333'
  WHERE subject_id = '2958e3c8-ab45-4ea5-a48f-86ae843eb336';
UPDATE public.qb_exam_sessions SET subject_id = '44444444-4444-4444-4444-444444444444'
  WHERE subject_id IN ('fc8f4df4-01e7-473e-a976-a0a64e431164','c3b63be5-f7bf-41cf-a7b7-af65bed75214','894be49f-36bd-40b9-bc86-050733c1946f','41953c02-00c0-41e5-8a06-dba022a52b49');

-- 4. Archive old subjects
UPDATE public.qb_subjects SET is_active = false
  WHERE id IN ('2f14b43b-2713-4f1e-b284-58c5597166d3','11dc4603-b32e-424b-920a-0c2f13c5b3ff','73246f68-0d3c-45d4-95f5-07698eb47537','28c4dffd-2bb6-4453-8254-12154945ebf7','17f9d89c-c880-4727-af03-d5dcbb3e93a2','2958e3c8-ab45-4ea5-a48f-86ae843eb336','fc8f4df4-01e7-473e-a976-a0a64e431164','c3b63be5-f7bf-41cf-a7b7-af65bed75214','894be49f-36bd-40b9-bc86-050733c1946f','41953c02-00c0-41e5-8a06-dba022a52b49');

-- 5. Make subject_id nullable on sessions (for mixed exams)
ALTER TABLE public.qb_exam_sessions ALTER COLUMN subject_id DROP NOT NULL;

-- 6. Leaderboard difficulty column + constraint swap
ALTER TABLE public.qb_leaderboard_cache ADD COLUMN IF NOT EXISTS difficulty public.qb_difficulty NULL;
ALTER TABLE public.qb_leaderboard_cache DROP CONSTRAINT IF EXISTS qb_leaderboard_cache_user_id_period_subject_id_key;
TRUNCATE public.qb_leaderboard_cache;
ALTER TABLE public.qb_leaderboard_cache
  ADD CONSTRAINT qb_leaderboard_cache_unique_combo
  UNIQUE NULLS NOT DISTINCT (user_id, period, subject_id, difficulty);

-- 7. Default exam count 30, longer timers
CREATE OR REPLACE FUNCTION public.qb_start_exam(_subject_id uuid, _difficulty qb_difficulty, _topic_id uuid DEFAULT NULL::uuid, _question_count integer DEFAULT 30)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
$function$;

-- 8. Mixed-department exam
CREATE OR REPLACE FUNCTION public.qb_start_mixed_exam(_difficulty qb_difficulty, _question_count integer DEFAULT 30)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _qids UUID[];
  _session_id UUID;
  _time_limit INT;
  _questions JSONB;
  _per_subject INT;
  _active_count INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
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
END;
$function$;

-- 9. Leaderboard refresh: difficulty-aware buckets
CREATE OR REPLACE FUNCTION public.qb_refresh_leaderboard()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.qb_leaderboard_cache;

  -- All-time grand
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'all_time'::qb_leaderboard_period, NULL, NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(AVG(percentage)::NUMERIC, 2), SUM(score), RANK() OVER (ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL GROUP BY user_id;

  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'monthly', NULL, NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(AVG(percentage)::NUMERIC, 2), SUM(score), RANK() OVER (ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND submitted_at >= date_trunc('month', now()) GROUP BY user_id;

  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'weekly', NULL, NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(AVG(percentage)::NUMERIC, 2), SUM(score), RANK() OVER (ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND submitted_at >= date_trunc('week', now()) GROUP BY user_id;

  -- All-time, per subject
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'all_time', subject_id, NULL, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(AVG(percentage)::NUMERIC, 2), SUM(score),
         RANK() OVER (PARTITION BY subject_id ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND subject_id IS NOT NULL GROUP BY user_id, subject_id;

  -- All-time, per difficulty
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'all_time', NULL, difficulty, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(AVG(percentage)::NUMERIC, 2), SUM(score),
         RANK() OVER (PARTITION BY difficulty ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL GROUP BY user_id, difficulty;

  -- All-time, per (subject, difficulty)
  INSERT INTO public.qb_leaderboard_cache (user_id, period, subject_id, difficulty, total_exams, total_passed, avg_percentage, total_points, rank)
  SELECT user_id, 'all_time', subject_id, difficulty, COUNT(*), COUNT(*) FILTER (WHERE passed),
         ROUND(AVG(percentage)::NUMERIC, 2), SUM(score),
         RANK() OVER (PARTITION BY subject_id, difficulty ORDER BY SUM(score) DESC)
  FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND subject_id IS NOT NULL GROUP BY user_id, subject_id, difficulty;
END;
$function$;

SELECT public.qb_refresh_leaderboard();
