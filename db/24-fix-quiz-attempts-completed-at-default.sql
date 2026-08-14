-- Same class of bug as db/23 (assignment_submissions.graded_at):
-- quiz_attempts.completed_at had DEFAULT now(). The new start-quiz-attempt
-- endpoint (backend/src/functions/startQuizAttempt.js) explicitly inserts
-- completed_at = NULL to mark an attempt "in progress" for the timer to
-- work, which overrides the default fine -- but the wrong default is still
-- latent schema damage worth correcting.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

ALTER TABLE quiz_attempts ALTER COLUMN completed_at DROP DEFAULT;
