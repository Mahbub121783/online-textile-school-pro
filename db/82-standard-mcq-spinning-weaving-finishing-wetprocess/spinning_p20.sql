SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','f49d6153-1835-4455-81f3-2918d5d3484e',false);
BEGIN;
INSERT INTO public.qb_questions (subject_id, difficulty, question_type, question_text, options, correct_answer, explanation, points, tags) VALUES
('9dc3ade3-26ea-41fa-a83f-95a7440889b8', 'intermediate', 'multiple_choice', 'A mill blends 60% cotton with 40% polyester to spin 800 kg of yarn. If cotton costs $2/kg and polyester costs $1.5/kg, what is the approximate total fiber cost?', '["≈ $1,440","≈ $1,600","≈ $1,200","≈ $960"]'::jsonb, '≈ $1,440', 'Cotton weight = 0.60×800=480kg, cost=480×$2=$960. Polyester weight=0.40×800=320kg, cost=320×$1.5=$480. Total=$960+$480=$1,440.', 2, '{"blend-cost-calc"}'::text[]),
('9dc3ade3-26ea-41fa-a83f-95a7440889b8', 'intermediate', 'multiple_choice', 'A mill blends 70% cotton with 30% viscose to spin 1,000 kg of yarn. If cotton costs $2.20/kg and viscose costs $1.80/kg, what is the approximate total fiber cost?', '["≈ $2,080","≈ $2,200","≈ $1,800","≈ $2,000"]'::jsonb, '≈ $2,080', 'Cotton weight = 0.70×1,000=700kg, cost=700×$2.20=$1,540. Viscose weight=0.30×1,000=300kg, cost=300×$1.80=$540. Total=$1,540+$540=$2,080.', 2, '{"blend-cost-calc"}'::text[]);
COMMIT;
