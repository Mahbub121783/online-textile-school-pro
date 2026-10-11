SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','f49d6153-1835-4455-81f3-2918d5d3484e',false);

-- Lets admin log a describable extra task (e.g. "organized the spring
-- webinar") with its own point value -- distinct from the existing quick
-- "Adjust Points" delta (no description, doesn't show in the activity
-- breakdown stats). This writes into the same ambassador_activity_log table
-- as the automatic triggers from db/94, so it shows up in stats/breakdown
-- consistently and reuses the existing points-sync trigger unchanged.
ALTER TYPE public.ambassador_activity_type ADD VALUE IF NOT EXISTS 'admin_assigned';

-- ambassador_activity_log's INSERT policy (db/94) was service_role-only,
-- since every *automatic* award path elevates internally via
-- ambassador_award_activity(). A direct admin insert from the browser
-- carries role='authenticated' with the admin's own sub, never
-- service_role -- so it needs its own explicit branch, same pattern as
-- every other staff-writable table in this app (campus_notices,
-- ambassador_applications, orders, etc).
DROP POLICY IF EXISTS "Only service role writes activity log" ON public.ambassador_activity_log;
DROP POLICY IF EXISTS "Service role or admin writes activity log" ON public.ambassador_activity_log;
CREATE POLICY "Service role or admin writes activity log" ON public.ambassador_activity_log
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );
