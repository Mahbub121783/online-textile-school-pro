-- assignment_submissions.graded_at was reconstructed (from types.ts, no
-- real migration source -- see db/05-bootstrap-policies.sql notes) with
-- DEFAULT now(), so every submission gets a graded_at timestamp the
-- instant it's submitted, before any instructor has actually graded it.
-- Confirmed live: a fresh 'submitted' row (score=null) came back with
-- graded_at already populated. Not currently read anywhere to drive UI
-- (grading queues correctly filter on `status`, not graded_at), but it's
-- wrong data and would corrupt any future "grading turnaround time" or
-- "ungraded submissions" feature built against this column.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- Same recurring bug class again: "Owners and instructors update
-- assignment submissions" had no service_role branch, so the cleanup
-- UPDATE below silently affected 0 rows the first time this ran.
DROP POLICY IF EXISTS "Owners and instructors update assignment submissions" ON public.assignment_submissions;
CREATE POLICY "Owners and instructors update assignment submissions" ON public.assignment_submissions
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      user_id = auth.uid()
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'instructor')
      OR has_role(auth.uid(), 'super_admin')
    ))
  );

ALTER TABLE assignment_submissions ALTER COLUMN graded_at DROP DEFAULT;

UPDATE assignment_submissions
SET graded_at = NULL
WHERE status IS DISTINCT FROM 'graded' AND score IS NULL;
