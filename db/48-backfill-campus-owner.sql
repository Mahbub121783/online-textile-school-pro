-- Data fix, not a code bug: the only real campus in the system (Textile
-- Engineering College Noakhali / "tecn") was created with submitted_by NULL
-- -- it predates the auth-gated registration flow (CampusOnboardRegister.tsx
-- has always set submitted_by = user.id since that flow existed, so this is
-- legacy/manually-inserted data, not a path that can recur going forward).
-- With no submitted_by, every "the requester's own account can manage their
-- campus" check (MyCampusPage's ownedCampus query, campusUpdate's isOwner
-- check, DashboardSidebar's "Campus Onboard" menu item) correctly found no
-- match -- that's the exact behavior the user reported as broken.
-- The row's contact_email matches a real, existing account exactly
-- (confirmed via direct lookup against auth.users before writing this), so
-- backfilling submitted_by to that account is a safe, unambiguous fix.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

UPDATE public.campus_onboard_requests c
SET submitted_by = au.id
FROM auth.users au
WHERE c.subdomain_slug = 'tecn'
  AND c.submitted_by IS NULL
  AND lower(au.email) = lower(c.contact_email);
