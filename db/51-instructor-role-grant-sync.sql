-- Root cause (found via exploration + confirmed by reading the actual
-- code): granting the 'instructor' role via Admin > Users > Role Manager
-- only ever inserted into user_roles. But the admin's own "Instructor
-- Mgmt" page defaults to the Approvals tab, which lists instructors purely
-- from `instructor_applications` -- a completely separate table, only
-- populated by the self-serve "Become an Instructor" application flow. A
-- directly role-granted user had no such row, so they were invisible on
-- the very first tab an admin looks at, even though their role was granted
-- correctly. This trigger keeps the two in sync from either direction:
-- granting the role now also creates/approves a matching application row,
-- so "grant role" and "approve application" converge on the same state.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- instructor_applications' INSERT policy only ever allowed a user to
-- create their OWN application (user_id = auth.uid()) -- there was no
-- admin/service_role path, so an admin (or this trigger, which inherits
-- the admin's own session context, not real Postgres role escalation)
-- inserting a row on someone else's behalf was rejected by RLS. Additive
-- policy, same pattern used elsewhere this session (Postgres OR-combines
-- multiple permissive policies automatically).
DROP POLICY IF EXISTS "Admins and service role create instructor applications" ON public.instructor_applications;
CREATE POLICY "Admins and service role create instructor applications" ON public.instructor_applications
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

CREATE OR REPLACE FUNCTION public.sync_instructor_application_on_role_grant()
RETURNS trigger AS $$
DECLARE
  v_full_name text;
  v_email text;
  v_existing_id uuid;
  v_granting_admin uuid := auth.uid();
BEGIN
  IF NEW.role <> 'instructor' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing_id FROM public.instructor_applications WHERE user_id = NEW.user_id LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.instructor_applications
    SET status = 'approved', reviewed_at = now(), reviewed_by = COALESCE(v_granting_admin, reviewed_by)
    WHERE id = v_existing_id AND status <> 'approved';
  ELSE
    SELECT full_name INTO v_full_name FROM public.user_profiles WHERE id = NEW.user_id;
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;

    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    INSERT INTO public.instructor_applications
      (user_id, full_name, email, expertise, status, reviewed_at, reviewed_by)
    VALUES (
      NEW.user_id,
      COALESCE(v_full_name, 'N/A'),
      COALESCE(v_email, 'unknown@onlinetextileschool.com'),
      'Not specified — role granted directly by an admin',
      'approved', now(), v_granting_admin
    );
  END IF;

  -- FinancialsTab/CommunicationsTab filter their instructor pickers on
  -- is_active=true, but user_profiles.is_active defaults to false -- a
  -- role an admin just explicitly granted should be usable everywhere
  -- immediately, not only on Access Board (the one tab with no such filter).
  UPDATE public.user_profiles SET is_active = true WHERE id = NEW.user_id AND is_active = false;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_instructor_application_on_role_grant ON public.user_roles;
CREATE TRIGGER trg_sync_instructor_application_on_role_grant
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_instructor_application_on_role_grant();

-- Backfill: the trigger above only covers NEW role grants going forward --
-- any instructor role already granted directly (bypassing the application
-- flow) before this migration is still invisible on Approvals and still
-- has no application row for Access Board's Reset Password to read an
-- email from. Fix existing data the same way.
INSERT INTO public.instructor_applications (user_id, full_name, email, expertise, status, reviewed_at)
SELECT ur.user_id, COALESCE(up.full_name, 'N/A'), COALESCE(au.email, 'unknown@onlinetextileschool.com'),
       'Not specified — role granted directly by an admin', 'approved', now()
FROM public.user_roles ur
JOIN public.user_profiles up ON up.id = ur.user_id
JOIN auth.users au ON au.id = ur.user_id
WHERE ur.role = 'instructor'
  AND NOT EXISTS (SELECT 1 FROM public.instructor_applications ia WHERE ia.user_id = ur.user_id);

UPDATE public.user_profiles up
SET is_active = true
FROM public.user_roles ur
WHERE ur.user_id = up.id AND ur.role = 'instructor' AND up.is_active = false;
