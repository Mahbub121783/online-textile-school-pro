-- Campus Onboard, phase 6: Principal/VC leadership details, an ownership
-- transfer flow (owner-initiated, admin-approved), and a guard against the
-- same campus name being onboarded twice.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

ALTER TABLE public.campus_onboard_requests
  ADD COLUMN IF NOT EXISTS principal_name text,
  ADD COLUMN IF NOT EXISTS principal_designation text,
  ADD COLUMN IF NOT EXISTS principal_photo_url text,
  ADD COLUMN IF NOT EXISTS principal_phone text,
  ADD COLUMN IF NOT EXISTS principal_email text,
  ADD COLUMN IF NOT EXISTS pending_owner_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ownership_transfer_status text,
  ADD COLUMN IF NOT EXISTS ownership_transfer_note text,
  ADD COLUMN IF NOT EXISTS ownership_transfer_requested_at timestamptz;

-- Only one campus onboarding per campus name at a time -- a rejected
-- request doesn't permanently block the name (it's excluded here so the
-- same institution can reapply), but you can't have two pending/approved
-- requests for "the same" campus name (case-insensitive) simultaneously.
DROP INDEX IF EXISTS idx_campus_onboard_requests_unique_active_name;
CREATE UNIQUE INDEX idx_campus_onboard_requests_unique_active_name
  ON public.campus_onboard_requests (lower(campus_name))
  WHERE status IN ('pending', 'approved');

-- Notify every admin when a campus owner requests to transfer ownership --
-- same pattern as the other campus lifecycle notifications in db/47.
CREATE OR REPLACE FUNCTION public.notify_campus_ownership_transfer_requested()
RETURNS trigger AS $$
BEGIN
  IF NEW.pending_owner_id IS NULL OR NEW.pending_owner_id IS NOT DISTINCT FROM OLD.pending_owner_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT ur.user_id, 'campus_ownership_transfer_requested', '🔁 Campus Ownership Transfer Requested',
         NEW.campus_name || ' has a pending ownership transfer awaiting approval.',
         '/admin/campus-onboard'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'super_admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_campus_ownership_transfer_requested ON public.campus_onboard_requests;
CREATE TRIGGER trg_notify_campus_ownership_transfer_requested
  AFTER UPDATE OF pending_owner_id ON public.campus_onboard_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_campus_ownership_transfer_requested();
