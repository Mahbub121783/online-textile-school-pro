# Free-Tier Survival Audit — what will break and how we fix it

I audited every hot path that runs for normal users (login, profile load, course/ebook listing, lesson player, practice exam). The Practice Arena work we did already covers the 500-concurrent-exam case. But there are **6 separate leaks** that will kill the free tier independently of Practice. This plan fixes each one.

## What's already safe ✅
- Practice exam start/submit/heartbeat/integrity batching (just done).
- `pg_cron` jobs: leaderboard refresh, prune, aggregate stats, orphan close.
- `useAuth` profile cache (localStorage + 2-min memory).
- React Query global defaults (2-min stale, 30-min GC).
- Notifications use 60s polling that pauses on hidden tabs.
- Cloudinary + R2 offload media egress (zero Supabase Storage hit).

## What WILL break on free tier ❌

### 1. ChatWidget opens a persistent realtime channel for every logged-in user
`src/components/chat/ChatWidget.tsx:394` subscribes `chat-rt-${uid}` on mount of every dashboard page. Free tier = **200 concurrent realtime connections**. 500 logged-in users = instant cap hit, then chat + auth listeners start dropping. The presence channel only mounts when the widget is open — that one is fine.

**Fix:** Move the always-on `chat-rt-${uid}` subscription so it only mounts when the chat widget panel is `open`, OR replace it with a 30–45s polling refetch of unread counts (same pattern as `useNotifications`). Keep the presence/typing channel as-is (gated by `open`).

### 2. LessonPlayer opens a realtime channel per lesson view
`src/pages/learn/LessonPlayer.tsx:223` subscribes `lesson-discussions-${courseId}-${lessonId}` for every viewer. 200 students simultaneously watching = 200 more channels stacked on top of #1.

**Fix:** Replace with React Query `refetchInterval: 45_000` on the discussions query (pauses on hidden tab). Discussions don't need sub-second freshness.

### 3. LessonPlayer upserts `lesson_progress` every 15s of playback
`LessonPlayer.tsx:243` writes a row every 15s while video plays. 200 concurrent viewers × 4 writes/min = 48K writes/hour just for progress. Combined with practice exam writes this will spike DB I/O.

**Fix:** Bump to every 30s, AND skip write if `document.hidden`, AND skip if position hasn't advanced ≥10s since last save. Drops to ~3–4K writes/hour for the same audience.

### 4. StatsSection on the homepage runs 4 unauthenticated count queries
`StatsSection.tsx:73` runs 4 `count: 'exact', head: true` queries on `user_roles`, `courses`, `user_profiles`, plus a full `avg_rating` scan. 24h client cache helps repeat visitors, but **every fresh anon visitor** triggers it. With Google traffic this is the single biggest free-tier risk on the public site (exact counts on large tables are expensive).

**Fix:** Create a tiny `public.homepage_stats` table (one row) refreshed by a `pg_cron` job every 6h. Public read RLS. Replace the 4 queries with one `select * from homepage_stats limit 1`. Drops cost by ~99%.

### 5. `select('*')` on enrollments / class_videos / courses
`useEnrollments.ts`, `useClassVideos.ts`, `useCouponValidation.ts`, several admin pages. Each row carries unused columns (descriptions, long_descriptions, JSONB metadata) — bloats egress and serialization cost.

**Fix:** Replace `select('*')` with explicit column lists on the **5 hottest hooks only** (enrollments, classVideos, courseList, ebookList, profile). Skip admin pages — low traffic.

### 6. Audit-script tail risks (low priority but worth knowing)
- 566 "unbounded list" warnings — most are `.eq('user_id', auth.uid())` so naturally tiny. Not worth touching now.
- `LiveSessionsTab.tsx` polls every 60s (admin only, fine).
- `AdminUsers` realtime channel (admin only, fine).
- Two `setInterval` in `security.ts` and `popups` — pure client, no DB hit.

## Plan (in this order — biggest impact first)

1. **ChatWidget global channel → gated by `open` + add 45s polling fallback for unread badge** *(fixes #1)*
2. **LessonPlayer discussions realtime → polling** *(fixes #2)*
3. **LessonPlayer progress upsert → 30s + advanced-only + visibility check** *(fixes #3)*
4. **Migration: create `public.homepage_stats` table + `qb_refresh_homepage_stats()` function + cron every 6h. Update `StatsSection` to read from it.** *(fixes #4)*
5. **Trim `select('*')` in `useEnrollments`, `useClassVideos`, `useCouponValidation` to explicit columns** *(fixes #5)*
6. **Verify**: rerun `bun scripts/audit-free-tier.ts`, confirm realtime-channel count drops, confirm no behavior regressions.

## Projected impact (combined with already-done Practice work)

| Metric | Before today | After this plan |
|---|---|---|
| Concurrent realtime channels @ 500 users | ~1000+ (over cap) | **<10** (only open chat widgets + presence) |
| Lesson progress writes/hour @ 200 viewers | 48K | ~4K |
| Homepage cost per anon visitor | 4 count queries | 1 small row read |
| Egress per dashboard load | unchanged | -20–30% (trimmed `select *`) |
| Free-tier ceiling headroom | tight at 200 MAU | **safe to 1000+ MAU** |

## Out of scope (intentionally not touching)
- UI/visual changes — none.
- Practice exam code — already optimized in the prior batch.
- Admin pages — low traffic, optimizing them gives near-zero free-tier benefit.
- Image/file storage — already offloaded to Cloudinary/R2.

If you approve, I implement steps 1–5 (one migration + ~6 file edits), then run the audit script to confirm.
