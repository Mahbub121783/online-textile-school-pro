-- user_profiles.is_active had a column DEFAULT of false (confirmed live via
-- information_schema) -- handle_new_user() never sets is_active explicitly,
-- so every single new registration silently fell back to that default and
-- showed up as "Blocked" on the admin Student Management page. Verified via
-- admin_activity_log (action IN ('block_student','activate_student')) that
-- zero admin block/activate actions have ever been taken -- every currently
-- "blocked" row is purely this bug, not a genuine moderation decision, so
-- it's safe to backfill all of them back to active.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

ALTER TABLE public.user_profiles ALTER COLUMN is_active SET DEFAULT true;

UPDATE public.user_profiles SET is_active = true WHERE is_active = false;
