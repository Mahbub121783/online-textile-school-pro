SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','f49d6153-1835-4455-81f3-2918d5d3484e',false);
BEGIN;
INSERT INTO public.qb_questions (subject_id, difficulty, question_type, question_text, options, correct_answer, explanation, points, tags) VALUES
('9dc3ade3-26ea-41fa-a83f-95a7440889b8', 'intermediate', 'multiple_choice', 'A length of yarn measuring 4,200 yards weighs exactly 0.25 lb. What is its count in Ne (hanks of 840 yards per lb)?', '["20s Ne","4,200s Ne","0.25s Ne","16,800s Ne"]'::jsonb, '20s Ne', 'Ne = total yards ÷ (840 × weight in lb) = 4,200 ÷ (840 × 0.25) = 4,200 ÷ 210 = 20s Ne.', 2, '{"ne-from-weight-length"}'::text[]),
('9dc3ade3-26ea-41fa-a83f-95a7440889b8', 'intermediate', 'multiple_choice', 'A length of yarn measuring 12,600 yards weighs exactly 0.5 lb. What is its count in Ne?', '["30s Ne","12,600s Ne","0.5s Ne","25,200s Ne"]'::jsonb, '30s Ne', 'Ne = total yards ÷ (840 × weight in lb) = 12,600 ÷ (840 × 0.5) = 12,600 ÷ 420 = 30s Ne.', 2, '{"ne-from-weight-length"}'::text[]),
('9dc3ade3-26ea-41fa-a83f-95a7440889b8', 'intermediate', 'multiple_choice', 'A mill needs to produce 500 kg of 30s Ne yarn per day. If a single spindle at this count produces 0.2 kg per day at the mill''s operating efficiency, approximately how many spindles are needed?', '["2,500 spindles","500 spindles","100 spindles","2,000 spindles"]'::jsonb, '2,500 spindles', 'Spindles needed = total target output ÷ output per spindle = 500 kg ÷ 0.2 kg = 2,500 spindles.', 2, '{"spindle-requirement-calc"}'::text[]);
COMMIT;
