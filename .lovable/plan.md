## Critical Issues Found (Free-tier focused)

After deep scan: **104 linter issues + concrete free-tier risks**. Most are noise, but **4 are genuinely critical** on a 500 MB / shared-compute plan.

---

### CRITICAL #1 — Exploitable maintenance functions (DOS + admin spam)

Any logged-in user (even any anon visitor for some) can call these `SECURITY DEFINER` functions directly via the REST API. They were meant for cron only:

| Function | Risk if called by attacker |
|---|---|
| `kill_idle_connections()` | Kills your DB connections → instant DOS |
| `prune_free_tier_data()` | Deletes notifications, email logs, SMS logs, audit logs |
| `cleanup_old_ai_chats()` | Wipes chat history |
| `pg_housekeeping_daily()` | Same — destructive deletes |
| `auto_update_workshop_status()` | Flips workshop states |
| `qb_refresh_leaderboard()` / `qb_aggregate_question_stats()` | Heavy compute on demand → CPU exhaustion on free tier |
| `refresh_homepage_stats()` | Heavy materialised refresh |
| `bulk_issue_workshop_certificates()` | Mass insert / notifications |
| `notify_admins()` | Admin notification spam |
| `maybe_run_*` (3 wrappers) | Triggers HTTP egress via pg_net |

**Fix**: `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated;` for all of these. Cron runs as `postgres` so it keeps working. This kills ~30 of the 104 linter warnings at once.

### CRITICAL #2 — `cron.job_run_details` bloats DB (33 MB of 62 MB total)

Free tier limit is 500 MB. Cron logs alone = **53% of your DB**. Even after DELETE, disk doesn't shrink without `VACUUM FULL`.

**Fix**:
1. One-time `VACUUM FULL cron.job_run_details` (drops 33 MB → <1 MB).
2. Disable `cron.log_run` going forward (set to `off`) — Supabase cron run details are not actually useful for you, and they're the #1 free-tier killer.
3. Also vacuum `net._http_response` and add it to daily housekeeping (currently 1.7 MB and growing).

### CRITICAL #3 — Public `media` bucket allows directory listing

Anyone can list every file in the `media` bucket via the storage API, even if they don't know the filenames. Sensitive uploads (eBooks covers, user avatars, internal docs) become enumerable.

**Fix**: Replace `storage.objects` SELECT-everything policy on `bucket_id='media'` with a policy that only allows reading a specific object by name (no `LIST`). Public read of known URLs still works.

### CRITICAL #4 — Auth: leaked-password protection disabled

Supabase has free HaveIBeenPwned check; currently off. Easy enable via Auth settings.

---

## Non-critical / by-design (will document, not fix)

- 4 "Always-true" RLS warnings on `workshop_registrations` (INSERT), `popup_analytics` (INSERT), `popup_submissions` (INSERT), `class_video_views` (INSERT) → all intentional public-write flows.
- 4 "Service role full access" policies on `ai_chat_history`, `email_logs`, `email_unsubscribes`, `ai_api_keys`, `ai_search_index` → service role bypasses RLS anyway; harmless but documented.
- `password_reset_codes` table has RLS enabled with no policy → fully locked, only service role can touch → correct.
- Remaining `SECURITY DEFINER` warnings are on functions that genuinely need to be callable (`has_role`, `get_my_profile`, `qb_submit_exam`, `claim_my_workshop_certificate`, wallet fns, certificate issuance, etc.). These are safe by design.

---

## Implementation plan

**Single migration** that does:

1. `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` on the ~12 maintenance/cron-only functions listed above.
2. `ALTER SYSTEM` not allowed on Supabase → instead, set `cron.log_run = off` at the database level via `ALTER DATABASE postgres SET cron.log_run = off;` **— wait, instructions forbid `ALTER DATABASE postgres` statements**. Alternative: keep logging but make daily housekeeping prune `cron.job_run_details` to **last 24 hours** instead of last 7 days, and add a daily `VACUUM FULL` (cron-scheduled, runs at 04:35 after the regular vacuum).
3. One-shot `VACUUM FULL cron.job_run_details` + `VACUUM FULL net._http_response` executed inside the migration (these can run in a migration since they're not in our protected schemas — `cron` and `net` are Postgres extensions, not Supabase-reserved like `auth`/`storage`/`realtime`).
4. Drop the existing broad `storage.objects` SELECT policy on `bucket_id='media'` and replace with a "read single object by name" policy (no LIST permission).
5. Update memory note about which `SECURITY DEFINER` functions are intentionally callable.

**Manual (you do)**: in Supabase Dashboard → Authentication → Policies → enable **Leaked password protection**. (Cannot be toggled via SQL.)

---

## Expected impact

| Metric | Before | After |
|---|---|---|
| DB size | 62 MB | ~28 MB |
| Linter warnings | 104 | ~70 (the rest are by-design false positives) |
| Exploitable maintenance fns | 12 | 0 |
| Public listable buckets | 1 | 0 |
| Daily cron log growth | unbounded | capped at 24 h, vacuumed nightly |

Free tier headroom recovered, real attack surface eliminated, and ja by-design seita memory te document hobe so future scans noise generate korbe na.
