# Disabled workflows

`deploy.yml.DISABLED-legacy-FTP-conflicts-with-selfhost` was the original
Lovable-era GitHub Actions workflow: on every push to `main` it ran
`bun run build` using the repo's committed `.env` (which points at the
now-deleted Supabase project) and FTP-deployed the result straight into
`onlinetextileschool.com/`'s document root -- the same folder the
self-hosted backend's frontend is manually deployed to.

Site is now self-hosted (see `db/`, `backend/`, and the memory file
`project-ots-selfhost-progress`). This workflow was never removed during
that migration. On 2026-09-24 a routine `git push` to `main` silently
re-triggered it, which rebuilt against the dead Supabase project and
overwrote the live, working self-hosted build -- taking
www.onlinetextileschool.com down (blank page) with no error visible in
this repo or in the manual deploy process.

Moved out of `.github/workflows/` (GitHub only triggers files literally
in that directory) so pushing to `main` can never trigger it again.
Deploys now happen only via the manual SCP/SSH process documented in the
selfhost-progress memory file. Do not move this back into
`.github/workflows/` without first fixing its build env and confirming
it targets the correct backend -- or better, deleting it outright once
confirmed unnecessary.
