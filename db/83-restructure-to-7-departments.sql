-- Restructures the 13 practice-question-bank subjects down to 7 departments,
-- per explicit request. Mapping (confirmed with user for the two ambiguous
-- cases -- Quality Control and the brand-new Automation department):
--
--   Apparel Engineering       <- Apparel & Management + Garments Technology
--   Fabric Engineering        <- Fabric Manufacturing + Weaving + Knitting
--   Yarn Engineering          <- Yarn + Spinning + Yarn Technology
--   Wet Process Engineering   <- Dyeing & Finishing + Wet Processing
--   Textile Management        <- Textile Management + Merchandising
--   IPE                       <- Quality Control
--   Automation and Control Engineering (textile & IT related) <- new, empty
--
-- Strategy: reuse 6 of the 13 existing subject UUIDs as the merge target
-- (rename in place) rather than creating 7 fresh rows and deleting 13 --
-- this preserves existing references/history for the "surviving" subject
-- and minimizes moving parts. Only Automation is a genuinely new row since
-- nothing in the current 13 maps to it.
--
-- Verified safe beforehand: 0 qb_exam_sessions and 0 qb_leaderboard_cache
-- rows reference any subject yet (no one has completed a real exam on the
-- live self-hosted site), so no student history is at risk. qb_questions
-- is remapped BEFORE the donor subject rows are deleted (qb_questions.
-- subject_id is ON DELETE CASCADE -- deleting a subject with live
-- questions still pointing at it would silently delete those questions).
-- qb_topics cascades away with its deleted parent subject safely, since
-- qb_questions.topic_id is ON DELETE SET NULL, not CASCADE -- affected
-- questions just lose their fine-grained topic tag, keeping full content.

SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','f49d6153-1835-4455-81f3-2918d5d3484e',false);

BEGIN;

-- 1. Rename 5 existing subjects to become their consolidated department
--    (Textile Management needs no rename -- name already matches).
UPDATE public.qb_subjects SET name = 'Yarn Engineering', slug = 'yarn-engineering', sort_order = 3
  WHERE id = '11111111-1111-1111-1111-111111111111'; -- was "Yarn"
UPDATE public.qb_subjects SET name = 'Fabric Engineering', slug = 'fabric-engineering', sort_order = 2
  WHERE id = '22222222-2222-2222-2222-222222222222'; -- was "Fabric Manufacturing"
UPDATE public.qb_subjects SET name = 'Wet Process Engineering', slug = 'wet-process-engineering', sort_order = 4
  WHERE id = '33333333-3333-3333-3333-333333333333'; -- was "Wet Processing"
UPDATE public.qb_subjects SET name = 'Apparel Engineering', slug = 'apparel-engineering', sort_order = 1
  WHERE id = '44444444-4444-4444-4444-444444444444'; -- was "Apparel & Management"
UPDATE public.qb_subjects SET name = 'IPE', slug = 'ipe', sort_order = 6
  WHERE id = '969f50f3-57d6-4bcd-8791-00db118d9ba0'; -- was "Quality Control"
UPDATE public.qb_subjects SET sort_order = 5
  WHERE id = 'ddedfe3c-fe07-4167-b56f-656c9fb89f5e'; -- "Textile Management" -- name unchanged

-- 2. New, empty department -- Automation and Control Engineering.
INSERT INTO public.qb_subjects (id, name, slug, is_active, sort_order)
VALUES (gen_random_uuid(), 'Automation and Control Engineering', 'automation-control-engineering', true, 7);

-- 3. Remap every question from the 7 donor subjects onto their target.
UPDATE public.qb_questions SET subject_id = '11111111-1111-1111-1111-111111111111' -- -> Yarn Engineering
  WHERE subject_id IN ('9dc3ade3-26ea-41fa-a83f-95a7440889b8', 'e512054c-240f-461d-9ccd-e6cc5c9e6411'); -- Spinning, Yarn Technology
UPDATE public.qb_questions SET subject_id = '22222222-2222-2222-2222-222222222222' -- -> Fabric Engineering
  WHERE subject_id IN ('4b495e60-fc2b-4165-a0c7-e0b144e931f7', '0a50ae12-e000-4b92-a5e9-3735064814d2'); -- Weaving, Knitting
UPDATE public.qb_questions SET subject_id = '33333333-3333-3333-3333-333333333333' -- -> Wet Process Engineering
  WHERE subject_id = '9e3b3072-3153-414d-b2d7-1bf0789002ac'; -- Dyeing & Finishing
UPDATE public.qb_questions SET subject_id = '44444444-4444-4444-4444-444444444444' -- -> Apparel Engineering
  WHERE subject_id = '3c09b2b2-10bd-4e1e-a51d-661d013948bc'; -- Garments Technology
UPDATE public.qb_questions SET subject_id = 'ddedfe3c-fe07-4167-b56f-656c9fb89f5e' -- -> Textile Management
  WHERE subject_id = '8b81a645-306d-4cc1-962a-ab597d640fe5'; -- Merchandising

-- 4. Now safe to delete the 7 donor subject rows (0 questions reference
--    them anymore). Cascades their qb_topics rows away too.
DELETE FROM public.qb_subjects WHERE id IN (
  '9dc3ade3-26ea-41fa-a83f-95a7440889b8', -- Spinning
  'e512054c-240f-461d-9ccd-e6cc5c9e6411', -- Yarn Technology
  '4b495e60-fc2b-4165-a0c7-e0b144e931f7', -- Weaving
  '0a50ae12-e000-4b92-a5e9-3735064814d2', -- Knitting
  '9e3b3072-3153-414d-b2d7-1bf0789002ac', -- Dyeing & Finishing
  '3c09b2b2-10bd-4e1e-a51d-661d013948bc', -- Garments Technology
  '8b81a645-306d-4cc1-962a-ab597d640fe5'  -- Merchandising
);

COMMIT;

\echo '--- final 7 departments ---'
SELECT s.name, COUNT(q.id) AS total_questions, s.sort_order
FROM public.qb_subjects s LEFT JOIN public.qb_questions q ON q.subject_id = s.id
GROUP BY s.name, s.sort_order ORDER BY s.sort_order;

\echo '--- sanity: any question still pointing at a deleted subject? (should be 0 rows) ---'
SELECT COUNT(*) FROM public.qb_questions WHERE subject_id NOT IN (SELECT id FROM public.qb_subjects);
