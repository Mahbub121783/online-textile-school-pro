# Free-Tier Hardening Plan — Practice Arena @ 500 concurrent users

Goal: 500 students taking a 30-question exam simultaneously, 500+ MAU, **never** hitting Supabase free-tier limits (500 MB DB, 5 GB egress, 2 GB bandwidth, 500K Edge invocations, 200 concurrent realtime, 2M monthly Edge function calls).

## Current load profile (per exam, today)

| Action | Writes | Reads | Realtime |
|---|---|---|---|
| Start exam | 2 inserts + 1 update (times_used) | 1 questions query | — |
| During exam (30 min) | 30 heartbeats (1/min) + integrity logs | 0 | 0 |
| Submit | 1 RPC (30 answer rows + stats upsert + badges) | 1 RPC | — |
| Result view | 0 | 1 RPC | — |

**500 concurrent = ~15K heartbeats / 30 min + 500 submits + 15K answer rows + violation logs.** Manageable, but several leaks identified.

## Issues found

1. **`qb_questions.times_used`/`times_correct` updated on every start & submit** → write hotspot. 500 starts = 15,000 row updates in seconds (each question UPDATEs once per use).
2. **Heartbeat every 60s** → 500 users × 30 min = 15,000 writes per exam batch (pure waste — only used to detect orphan sessions).
3. **`qb_refresh_leaderboard()`** does full table scan + 6 INSERTs; if called on every submit it melts. Need pg_cron throttled refresh.
4. **`prune_free_tier_data()`** exists but no schedule visible — disk fills.
5. **Integrity logging** (`qb_log_violation`) writes per tab-blur. Aggressive users = 50+ writes/exam.
6. **`PracticeExam.tsx` reloads questions via `.in('id', question_ids)`** AFTER RPC already returned them in `qb_start_exam` — duplicate read. Free egress wasted.
7. **`qb_user_stats` upsert on every submit** is fine, but badge loop runs full `qb_badges` SELECT per submit — cache it.
8. **No DB indexes** verified on hot paths: `qb_exam_sessions(user_id, submitted_at)`, `qb_questions(subject_id, difficulty, is_active)`, `qb_exam_answers(session_id)`.
9. **Frontend React Query** already has 2-min stale + 30-min GC (good), but Practice pages may bypass with manual `supabase` calls — audit needed.
10. **Realtime**: already disabled globally (good). Confirm exam page opens zero channels.

## Plan

### Phase 1 — DB write reduction (biggest win)

**Migration:**
- Drop per-question `times_used`/`times_correct`/`correct_rate` columns from `qb_questions` (or stop updating them inline). Replace with a nightly `pg_cron` aggregate from `qb_exam_answers` into a small `qb_question_stats` materialized table. Saves ~15K writes per exam batch.
- Add indexes:
  - `qb_questions(subject_id, difficulty, is_active)`
  - `qb_exam_sessions(user_id, submitted_at DESC)`
  - `qb_exam_sessions(submitted_at) WHERE submitted_at IS NULL` (active sessions)
  - `qb_exam_answers(session_id)` if missing
- Rewrite `qb_submit_exam` to **batch-insert** answers via `unnest()` instead of per-row INSERT in a loop. One round-trip instead of 30.
- Cache active badges in a `STABLE` function or pass list as arg; skip badge loop entirely if user already has all badges.

### Phase 2 — Heartbeat & integrity throttling

- Bump heartbeat from 60s → **3 min** (only purpose is orphan-session cleanup; 3-min granularity is fine).
- Skip heartbeat entirely if `document.hidden` (already done — confirm).
- Debounce integrity logs in `useExamIntegrity`: batch up to 5 events into one RPC call every 30s rather than per-event.

### Phase 3 — Read reduction

- `PracticeExam.tsx`: use questions returned by `qb_start_exam` directly; **remove** the second `qb_questions.in()` query. Saves 500 reads + ~2 MB egress per batch.
- `qb_start_exam` already returns shuffled options at server — store and reuse; remove client-side `[...].sort()` re-render.
- `PracticeHome` / `PracticeSubject`: rely on `qb_subject_question_counts()` cached 5 min via React Query; never count from raw `qb_questions`.

### Phase 4 — Leaderboard & maintenance schedule

Schedule via `pg_cron` (insert tool, not migration — uses project URL/anon key):
- `qb_refresh_leaderboard()` — every 15 min (not on submit).
- `prune_free_tier_data()` — daily 03:00 Asia/Dhaka.
- New `qb_aggregate_question_stats()` — nightly, rebuilds `times_used`/`times_correct`.
- Auto-close orphan sessions: cron every 10 min, marks sessions with `last_heartbeat_at < now() - 15 min` and `submitted_at IS NULL` as auto-submitted (server picks best answers from `qb_exam_answers`).

### Phase 5 — Client query hygiene

- Run `bun scripts/audit-query-cache.ts` and confirm no Practice file overrides `staleTime`/`refetchOnMount`.
- All Practice list pages: 5-min `staleTime`, no auto-refetch, no realtime subscriptions.
- Mark `PracticeWidget` and `PracticePage` queries with shared cache keys so dashboard + practice page share one fetch.

### Phase 6 — Egress trimming

- Restrict `qb_get_session_result` to NOT return `explanation` until user opens a question (separate RPC) — saves ~30% payload.
- Strip `options` shuffling cost: server returns pre-shuffled JSONB once, stored in `qb_exam_sessions.question_ids_order` (already implicit).
- Add `Cache-Control: public, max-age=300` on read-only RPCs through PostgREST when possible.

### Phase 7 — Monitoring

- Tiny `qb_load_metrics` view (active sessions, submits last hour, DB size) for admin dashboard — read once per minute, NOT per page mount.
- Add a free-tier audit script extension that flags any new useQuery without staleTime override.

## Projected impact

| Metric | Today (500 concurrent exam) | After plan |
|---|---|---|
| DB writes per exam batch | ~35,000 | ~3,500 (-90%) |
| Egress per exam | ~50 MB | ~15 MB (-70%) |
| Edge function invocations / mo | uncapped polling | <100K (well under 500K) |
| Leaderboard cost | per submit | every 15 min flat |
| Realtime channels | 0 (already) | 0 |

Comfortably stays inside free tier for **500 MAU and 500 concurrent exam-takers**, with room for ~2× growth before paid tier is needed.

## Technical notes

- All schema changes via `supabase--migration`.
- `pg_cron` schedules via `supabase--read_query`/insert tool (not migration) — contains project-specific URL + anon key.
- No frontend breaking changes; UI stays identical.
- Rollback safe: dropped counter columns recomputed by nightly job.
