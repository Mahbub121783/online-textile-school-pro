SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','f49d6153-1835-4455-81f3-2918d5d3484e',false);
BEGIN;
INSERT INTO public.qb_questions (subject_id, difficulty, question_type, question_text, options, correct_answer, explanation, points, tags) VALUES
('33333333-3333-3333-3333-333333333333', 'intermediate', 'multiple_choice', 'A stenter processes fabric at 30 meters per minute for an 8-hour shift at 90% uptime. Approximately how many meters of fabric are processed in that shift?', '["≈ 12,960 meters","≈ 14,400 meters","≈ 30 meters","≈ 240 meters"]'::jsonb, '≈ 12,960 meters', 'At 100% uptime: 30 m/min × 480 min = 14,400 meters. At 90% uptime: 14,400 × 0.90 = 12,960 meters.', 2, '{"stenter-production-calc"}'::text[]),
('33333333-3333-3333-3333-333333333333', 'intermediate', 'multiple_choice', 'A stenter processes fabric at 25 meters per minute for a 10-hour shift at 85% uptime. Approximately how many meters of fabric are processed in that shift?', '["≈ 12,750 meters","≈ 15,000 meters","≈ 25 meters","≈ 212.5 meters"]'::jsonb, '≈ 12,750 meters', 'At 100% uptime: 25 m/min × 600 min = 15,000 meters. At 85% uptime: 15,000 × 0.85 = 12,750 meters.', 2, '{"stenter-production-calc"}'::text[]);
COMMIT;
