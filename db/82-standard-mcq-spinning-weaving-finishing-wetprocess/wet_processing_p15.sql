SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','f49d6153-1835-4455-81f3-2918d5d3484e',false);
BEGIN;
INSERT INTO public.qb_questions (subject_id, difficulty, question_type, question_text, options, correct_answer, explanation, points, tags) VALUES
('33333333-3333-3333-3333-333333333333', 'intermediate', 'multiple_choice', 'A mill wants to reduce ETP treatment volume by processing only 20,000 liters per day instead of the current 32,000 liters. Approximately what percentage reduction does this represent?', '["≈ 37.5%","≈ 62.5%","≈ 12,000%","≈ 160%"]'::jsonb, '≈ 37.5%', 'Reduction % = ((old − new) / old) × 100 = ((32,000 − 20,000) / 32,000) × 100 = (12,000/32,000) × 100 = 37.5%.', 2, '{"etp-reduction-calc"}'::text[]),
('33333333-3333-3333-3333-333333333333', 'basic', 'multiple_choice', 'A finishing chemical recipe requires 4% (by weight of fabric) of a resin, for a batch of 750 kg fabric. How many kg of resin are needed?', '["30 kg","4 kg","75 kg","18.75 kg"]'::jsonb, '30 kg', 'Resin needed = 4% × fabric weight = 0.04 × 750 kg = 30 kg.', 1, '{"resin-recipe-calc"}'::text[]),
('33333333-3333-3333-3333-333333333333', 'basic', 'multiple_choice', 'A dyeing machine''s rated capacity is 500 kg per batch, and it completes 3 batches per day. What is the machine''s daily production capacity?', '["1,500 kg","500 kg","167 kg","3 kg"]'::jsonb, '1,500 kg', 'Daily capacity = batch size × number of batches per day = 500 × 3 = 1,500 kg.', 1, '{"daily-capacity-calc"}'::text[]);
COMMIT;
