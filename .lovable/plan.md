# Free-tier memory reduction plan (target <500MB)

## Diagnosis from live DB

| Signal | Now | Concern |
|---|---|---|
| Memory usage | **906 MB** | Way above 500 MB target |
| `shared_buffers` | 256 MB | Fixed by Supabase instance — can't change on free tier |
| `effective_cache_size` | 768 MB | Same — instance-level |
| `work_mem` | 3.5 MB / query | Multiplied by every concurrent sort/hash → 60 conns × heavy query = spikes |
| `max_connections` | 60 | Each idle connection = ~10 MB resident |
| Idle connections right now | 6 idle + 8 idle-in-tx | Idle-in-tx is the worst — pins memory |
| `cron.job_run_details` table | **33 MB** | Biggest user table by far, pure log bloat |
| Cron jobs running | 9 | `unreplied-message-reminder` runs **every minute** (1440×/day) — keeps a worker process hot constantly |

Postgres baseline on free-tier Supabase is ~600 MB. Everything above that is connections + cron history + query workspace. We attack those three.

## What we'll change (one migration + small app tweaks)

### 1. Stop the per-minute cron heater
`unreplied-message-reminder` runs every minute. That keeps a background worker resident and triggers `pg_net` HTTP allocations 1440× per day for almost no business value.
- **Reschedule to `*/15 * * * *`** (every 15 min). DM reminders don't need 60-second precision.
- **Reschedule `workshop-auto-status` from `*/2` to `*/10`** (same reasoning — status flip is not time-critical).
- **Reschedule `qb-auto-close-orphans` from `*/10` to `*/30`** (orphan threshold is 15 min anyway, every 30 min is fine).

Net: cron wake-ups drop from ~1740/day to ~250/day.

### 2. Aggressively prune log tables (the real memory + disk hog)
Add a new daily cron `pg_housekeeping_daily` at 04:00 that runs:
```sql
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '2 days';
DELETE FROM net._http_response  WHERE created   < now() - interval '1 day';
DELETE FROM public.email_logs   WHERE created_at < now() - interval '30 days';
DELETE FROM public.ai_chat_history WHERE created_at < now() - interval '14 days';
VACUUM (ANALYZE) cron.job_run_details, net._http_response, public.email_logs, public.ai_chat_history, public.qb_questions, public.user_profiles, auth.refresh_tokens, auth.sessions;
```
Reclaims ~30 MB immediately and prevents it from growing again. `VACUUM` also returns memory pages to the OS.

### 3. Kill long-idle and idle-in-transaction connections
Each idle connection holds ~10 MB. 14 idle/idle-in-tx right now = ~140 MB wasted.
- Add a cron `kill_idle_connections` every 5 min:
```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state IN ('idle in transaction','idle in transaction (aborted)')
  AND state_change < now() - interval '2 minutes';

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state = 'idle'
  AND state_change < now() - interval '10 minutes'
  AND application_name NOT LIKE 'realtime%'
  AND application_name NOT LIKE 'pg_cron%';
```
Expected reclaim: 80–120 MB sustained.

### 4. Lower `work_mem` ceiling per session
3.5 MB × 60 connections × multiple sort/hash nodes can momentarily allocate hundreds of MB during a heavy report query. Set the default lower; raise it only inside specific heavy RPCs.
```sql
ALTER DATABASE postgres SET work_mem = '2MB';
ALTER DATABASE postgres SET temp_buffers = '4MB';
ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '120s';
ALTER DATABASE postgres SET statement_timeout = '30s';
```
(`statement_timeout` also protects against runaway analytics queries silently eating RAM.)

### 5. Ensure clients use the connection pooler, not direct connections
Direct-mode connections each hold a full backend (~10 MB). Pooled connections share backends.
- **Audit**: confirm `src/integrations/supabase/client.ts` URL uses the standard `*.supabase.co` REST endpoint (it already does — PostgREST pools internally, so no change needed).
- **Edge functions**: confirm none of our edge functions open raw `pg` connections. If any do (e.g. via `Deno postgres` driver), switch them to the Supabase JS client so they reuse PostgREST. Quick grep audit during implementation; no behavior change expected.

### 6. Drop unused indexes (cheap win)
Run a one-shot read of `pg_stat_user_indexes WHERE idx_scan = 0` during implementation; drop any index with zero scans over the last 7 days that isn't a uniqueness constraint. Each unused index occupies shared_buffers when its table is touched.

## What we are **not** doing
- Not touching Practice Arena code (already optimized).
- Not removing any cron job that has business value (only reducing frequency).
- Not changing `shared_buffers` / `effective_cache_size` — Supabase free tier doesn't allow it.
- Not touching realtime / chat / lesson player — already hardened in the prior batch.

## Projected outcome

| Source | Now | After |
|---|---|---|
| Idle connection RAM | ~140 MB | ~30 MB |
| Cron worker churn | 1740/day wake-ups | ~250/day |
| Log table disk + buffer | 33 MB and growing | <5 MB, bounded |
| work_mem worst-case spike | up to ~200 MB | up to ~120 MB |
| **Steady memory** | **906 MB** | **~480–520 MB** |

That puts us at or just under the 500 MB working set, with headroom that grows the moment connections drop or pruning runs.

## Files to change
- **New migration** `xxxxx_free_tier_memory_diet.sql` — implements steps 1, 2, 3, 4, 6 above.
- No app/UI code changes required.

## Verification after rollout
1. Wait ~15 min, re-check Supabase Observability → Database → Memory usage.
2. `SELECT pg_size_pretty(pg_database_size('postgres'));` should drop by ~30 MB.
3. `SELECT state, count(*) FROM pg_stat_activity GROUP BY state;` — idle-in-tx should be 0, idle should be ≤3.

Approve to implement.
