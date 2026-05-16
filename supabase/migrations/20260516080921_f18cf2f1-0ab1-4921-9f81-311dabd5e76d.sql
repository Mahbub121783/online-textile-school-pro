-- Normalize MCQ options from [{key,text},...] -> [text,...]
-- and remap correct_answer (letter key) -> matching text.
WITH targets AS (
  SELECT id, options, correct_answer
  FROM public.qb_questions
  WHERE is_active = true
    AND question_type = 'multiple_choice'
    AND jsonb_typeof(options) = 'array'
    AND jsonb_typeof(options -> 0) = 'object'
),
remapped AS (
  SELECT
    t.id,
    (
      SELECT jsonb_agg(elem ->> 'text' ORDER BY ord)
      FROM jsonb_array_elements(t.options) WITH ORDINALITY AS x(elem, ord)
    ) AS new_options,
    (
      SELECT elem ->> 'text'
      FROM jsonb_array_elements(t.options) AS elem
      WHERE upper(trim(elem ->> 'key')) = upper(trim(t.correct_answer))
      LIMIT 1
    ) AS new_correct
  FROM targets t
)
UPDATE public.qb_questions q
SET options = r.new_options,
    correct_answer = COALESCE(r.new_correct, q.correct_answer)
FROM remapped r
WHERE q.id = r.id
  AND r.new_options IS NOT NULL
  AND r.new_correct IS NOT NULL;