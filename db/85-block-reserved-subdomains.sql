-- Nothing ever stopped a campus from registering (or an admin from
-- re-slugging on approval) with a subdomain_slug like "www", "api", "admin",
-- "mail", etc. Approval auto-provisions the real subdomain via
-- `uapi SubDomain addsubdomain` (see backend/src/functions/campusOnboard.js),
-- which would then collide with the live site's own infrastructure
-- (api.onlinetextileschool.com, www.onlinetextileschool.com, ...). The
-- frontend's campusSubdomain.ts already has a RESERVED_SUBDOMAINS list for
-- routing purposes, but that's purely client-side SPA logic -- it never
-- stopped the bad slug from being saved or provisioned in the first place.
-- This CHECK constraint is the actual enforcement point, mirrored in the
-- app-level validation added alongside this migration (backend and
-- registration form) for a friendlier error message before it ever reaches
-- the DB.
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', 'f49d6153-1835-4455-81f3-2918d5d3484e', false);

BEGIN;

ALTER TABLE public.campus_onboard_requests
  ADD CONSTRAINT campus_onboard_requests_subdomain_not_reserved
  CHECK (subdomain_slug NOT IN ('www', 'api', 'mail', 'cpanel', 'webmail', 'autodiscover', 'ftp', 'admin'));

COMMIT;

\echo '--- sanity check: constraint attached, existing rows unaffected ---'
SELECT count(*) AS total_campus_requests FROM public.campus_onboard_requests;
SELECT conname FROM pg_constraint WHERE conname = 'campus_onboard_requests_subdomain_not_reserved';
