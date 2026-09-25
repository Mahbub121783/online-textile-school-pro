SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','f49d6153-1835-4455-81f3-2918d5d3484e',false);
BEGIN;
INSERT INTO public.qb_questions (subject_id, difficulty, question_type, question_text, options, correct_answer, explanation, points, tags) VALUES
('9e3b3072-3153-414d-b2d7-1bf0789002ac', 'basic', 'multiple_choice', 'A dye recipe uses 3 different dyes at 0.8%, 0.3%, and 0.05% owf respectively, for a total combination shade. What is the total combined dye percentage owf?', '["1.15%","0.8%","1.05%","3%"]'::jsonb, '1.15%', 'Total %owf = sum of individual dye percentages = 0.8 + 0.3 + 0.05 = 1.15%.', 1, '{"combination-dye-calc"}'::text[]),
('9e3b3072-3153-414d-b2d7-1bf0789002ac', 'intermediate', 'multiple_choice', 'For a 3-dye combination recipe at 1.15% total owf on a 600 kg fabric batch, how many kg of total dye (all three dyes combined) are needed?', '["6.9 kg","1.15 kg","69 kg","0.69 kg"]'::jsonb, '6.9 kg', 'Total dye = %owf × fabric weight = 0.0115 × 600 kg = 6.9 kg.', 2, '{"combination-dye-calc"}'::text[]);
COMMIT;
