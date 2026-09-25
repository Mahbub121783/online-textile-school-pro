SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','f49d6153-1835-4455-81f3-2918d5d3484e',false);
BEGIN;
INSERT INTO public.qb_questions (subject_id, difficulty, question_type, question_text, options, correct_answer, explanation, points, tags) VALUES
('4b495e60-fc2b-4165-a0c7-e0b144e931f7', 'intermediate', 'multiple_choice', 'A pair of trousers requires 1.1 meters of fabric. For an order of 8,000 pairs plus a 6% cutting waste allowance, approximately how many total meters of fabric must be purchased?', '["≈ 9,328 meters","8,800 meters","≈ 8,272 meters","≈ 9,600 meters"]'::jsonb, '≈ 9,328 meters', 'Base fabric = 1.1 × 8,000 = 8,800 meters. With 6% waste: 8,800 × 1.06 = 9,328 meters.', 2, '{"fabric-consumption-with-waste"}'::text[]),
('4b495e60-fc2b-4165-a0c7-e0b144e931f7', 'intermediate', 'multiple_choice', 'A weaving mill''s target is 6,000 meters of fabric per day per loom at 80% efficiency. What is the theoretical (100% efficiency) daily capacity per loom?', '["≈ 7,500 meters","≈ 4,800 meters","≈ 6,000 meters","≈ 7,200 meters"]'::jsonb, '≈ 7,500 meters', 'Theoretical capacity = actual target ÷ efficiency = 6,000 ÷ 0.80 = 7,500 meters.', 2, '{"theoretical-capacity-calc"}'::text[]);
COMMIT;
