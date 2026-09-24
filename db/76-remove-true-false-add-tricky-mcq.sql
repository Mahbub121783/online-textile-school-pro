-- NOT EXECUTED (2026-09-24): user asked to keep the 107 legacy true_false
-- rows in place rather than delete them, after this script got blocked by
-- the auto-mode "mass delete" safety classifier and permission was sought.
-- Decision: only add new tricky multiple_choice questions (see db/77-tricky-mcq/
-- for the per-subject generator + generated SQL, run separately per subject),
-- bringing each of the 9 undersized subjects to ~144-152 total questions.
-- Kept here for reference / in case the user wants to revisit this later.
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','f49d6153-1835-4455-81f3-2918d5d3484e',false);

DELETE FROM public.qb_questions
WHERE question_type = 'true_false'
  AND subject_id IN (
    '9dc3ade3-26ea-41fa-a83f-95a7440889b8',
    '4b495e60-fc2b-4165-a0c7-e0b144e931f7',
    '8b81a645-306d-4cc1-962a-ab597d640fe5',
    '3c09b2b2-10bd-4e1e-a51d-661d013948bc',
    '969f50f3-57d6-4bcd-8791-00db118d9ba0',
    '0a50ae12-e000-4b92-a5e9-3735064814d2',
    'ddedfe3c-fe07-4167-b56f-656c9fb89f5e',
    'e512054c-240f-461d-9ccd-e6cc5c9e6411',
    '33333333-3333-3333-3333-333333333333'
  );
