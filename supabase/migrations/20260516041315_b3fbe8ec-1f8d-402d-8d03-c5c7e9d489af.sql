DELETE FROM public.qb_questions a USING public.qb_questions b
WHERE a.id < b.id
  AND a.question_text = b.question_text
  AND a.topic_id = b.topic_id;