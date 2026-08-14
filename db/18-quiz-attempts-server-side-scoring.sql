-- Quiz scoring was 100% client-computed: QuizPlayer.tsx calculated score/
-- percentage/passed in the browser then did a plain authenticated
-- .from('quiz_attempts').insert(...), which the existing RLS policy
-- ("user_id = auth.uid()") happily allowed with ANY submitted values --
-- a student could fabricate a passing score via devtools/curl, which also
-- undermines certificate auto-issuance (gradebook_pass rule reads
-- quiz_attempts). Likewise "Users update own quiz attempts" let a student
-- PATCH their own already-submitted attempt afterward to change the score.
--
-- Fix: quiz_attempts can now only be INSERTed by service_role (via the new
-- submit-quiz-attempt backend function, which fetches quiz_questions'
-- correct answers server-side and computes the authoritative score), and
-- can only be UPDATEd by staff (for manual_overrides/admin_feedback).
-- SELECT is untouched -- students still read their own attempt history.
DROP POLICY IF EXISTS "Users create own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Service role creates quiz attempts" ON public.quiz_attempts
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users update own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Staff update quiz attempts" ON public.quiz_attempts
  FOR UPDATE
  USING (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'super_admin'));

-- quiz_questions had no service_role SELECT branch -- needed so the new
-- scoring endpoint can read canonical correct_answer/sequence_items server-side.
DROP POLICY IF EXISTS "Service role reads quiz questions" ON public.quiz_questions;
CREATE POLICY "Service role reads quiz questions" ON public.quiz_questions
  FOR SELECT
  USING (auth.role() = 'service_role');

-- quiz_attempts SELECT also had no service_role branch -- needed so the
-- scoring endpoint can count the student's prior attempts to enforce
-- max_attempts server-side (previously only cosmetically hidden a button).
DROP POLICY IF EXISTS "Service role reads quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Service role reads quiz attempts" ON public.quiz_attempts
  FOR SELECT
  USING (auth.role() = 'service_role');
