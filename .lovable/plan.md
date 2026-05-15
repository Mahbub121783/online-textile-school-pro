## Direct answers

**1. Database এখন কত?**
- **56 MB / 500 MB** (11% used). 262 users, 184 notifications, 50 AI chats, 315 email logs. বড় টেবিলগুলোও সব <360 KB. অনেক জায়গা আছে।

**2. 500 concurrent user হলে Free Tier hit করবে?**
Free Tier limit আর আমাদের actual usage:

| Limit | Free cap | আমাদের estimate (500 active user) | ঝুঁকি |
|---|---|---|---|
| DB size | 500 MB | ~80–150 MB (retention জব দিলে) | ✅ safe |
| Direct DB conn | 60 (pooler) | API per request, normally OK | ✅ safe |
| Realtime concurrent | **200** | 500 logged-in tab × 1 channel = 500 | 🔴 **fail করবে** |
| Egress | **5 GB/mo** | `select('*')` থাকলে ~10–20 GB | 🔴 **fail করবে** |
| Edge fn calls | 500K/mo | sitemap+payment+ai = ঠিকঠাক | ✅ ok |
| Auth MAU | 50K | 500 → কোনো সমস্যা না | ✅ safe |
| Compute | Nano (~512MB) | unbounded select হলে timeout | 🟡 risk |

মূল bottleneck **disk না** — bottleneck হবে **Realtime connection cap (200)** আর **Egress bandwidth (5 GB)**. তাই plan সেই দুটোতে focus করতে হবে।

**3. DB compress / restructure করা যাবে?**
হ্যাঁ — কিন্তু কোনো feature/data নষ্ট না করে। নিচের সব non-destructive:
- `VACUUM FULL` + `REINDEX` — dead row reclaim, কোনো data যাবে না
- বড় JSONB কলাম (`certificates.template_snapshot`, `posts.content_blocks`) → snapshot-only রাখব, image base64 থাকলে storage bucket-এ সরাব
- Retention জব = পুরোনো log/analytics auto-delete (data না, log)
- Index audit — duplicate/unused index drop (data unaffected)

---

## Plan — "500 user free tier safe" (zero data loss, zero feature loss)

### Phase 1 — Realtime triage (সবচেয়ে important, 200 cap)
Goal: প্রত্যেক logged-in tab → 0 বা 1 channel only.

- `useNotifications` hook থেকে realtime channel **conditional** করব: শুধু `<NotificationBell>` mount হলে subscribe হবে, পুরো app-wide না।
- `useStudentRealtime`/`useInstructorRealtime`/`useAdminRealtime` — currently প্রতিটা page-এ mount হয়, এদেরকে শুধুমাত্র `DashboardLayout` / `InstructorLayout` / `AdminLayout`-এ একবার করে mount করব (page-level নয়)।
- ChatWidget channel → শুধু widget open থাকলে। Closed হলে disconnect (এখনই গেট আছে, double-check)।
- Result: 500 user × 1 channel max = 500 → **আরও কমাতে হবে**, তাই notification channel-কে also gated করব শুধু `unreadCount > 0` check-এর সময়—এর বদলে **30s polling fallback** দেব যদি `shouldSkipRealtime` true থাকে।
- Final: realtime শুধু যাদের সত্যি দরকার (chat open, bell hovered) → typically 50–100 concurrent channels।

### Phase 2 — Egress cut (5 GB/mo cap)
Goal: প্রতিটা list/detail query থেকে শুধু দরকারি column।

- Top 30 traffic-heavy file-এ `select('*')` → explicit column list (audit report থেকে priority list)।
- প্রত্যেক list catalog-এ `useInfiniteQuery` + `.range(0, 19)` (page size 20)।
- Detail page-এ `select('*')` thik ache (single row)।
- Estimated egress drop: 25 KB/req → 3 KB/req (~8× reduction)।

### Phase 3 — Caching aggressive করা (request count কমানো)
- React Query global stale time **2 min → 5 min** (lists), 30 min (CMS/static)
- `localStorage` persistence layer (already done in StatsSection) extend করব homepage → courses catalog, ebooks catalog
- Service worker (already exists `sw.ts`) — GET request cache 1h

### Phase 4 — DB retention (jodi free tier-e abar nameo, disk safe)
এক migration যা auto-cleanup add করে — কোনো user data delete করবে না, শুধু log/analytics:
- `popup_analytics` — 30 দিনের পুরোনো delete
- `admin_activity_log` — 90 দিন
- `email_logs` — 60 দিন
- `notifications` (read=true) — 30 দিন
- `qb_exam_violations` — 60 দিন
- `ai_chat_history` — already function ace, schedule দেব
- `engagement_events` (যদি থাকে) — 14 দিন
- পাশাপাশি `pg_cron` দিয়ে nightly schedule
- প্রতি migration-এ clear English summary দেব approval-এর সময়
- Estimated steady-state: 80–150 MB (বর্তমান 56 MB থেকে সামান্য বাড়বে কিন্তু explode করবে না)

### Phase 5 — DB compress (one-time cleanup)
- `VACUUM FULL` সব hot table-এ — dead tuple reclaim (data unchanged)
- `REINDEX` — bloated index ছোট হবে
- Unused index detect (`pg_stat_user_indexes WHERE idx_scan=0`) → drop suggestion list দেব approval-এর জন্য
- Estimated reclaim: 10–20 MB

### Phase 6 — Storage hygiene (frontend)
- `RichTextEditor` / `MailRichTextEditor` / blog block editor-এ paste করলে যদি base64 image থাকে → auto upload to `media` bucket, DB তে শুধু URL
- One-off admin tool: existing rows scan করে base64 detect → manual approval-এ migrate
- কোনো existing data delete হবে না, শুধু URL replace

### Phase 7 — Debounce + heartbeat (already partly done)
- `useDebouncedValue` hook (already shipped) — search input-গুলোয় wire করব
- `useExamHeartbeat` (already 60s + visibility-gated)
- `useEngagementTracking` — per-event INSERT → 30s batched flush

### Phase 8 — Edge function offload
500K free invocations enough, কিন্তু:
- `sitemap` edge function → CDN cache header `Cache-Control: public, max-age=3600`
- `og-meta` → একই
- Heavy aggregations (admin dashboard stats) → RPC একবার, frontend cache 5 min

---

## Safety guarantee

প্রতিটা phase-এ:
1. কোনো table drop করব না, কোনো column delete করব না
2. কোনো user-generated content delete করব না (শুধু log/analytics auto-prune)
3. প্রতি DB change-এ migration tool দিয়ে approval নেব
4. Realtime → polling fallback রাখব, তাই কেউ disconnect হলেও data refresh হবে (just 30s slower)
5. প্রত্যেক phase-এর পরে একটা smoke check list — homepage load, login, course detail, checkout, chat, notification bell
6. Rollback plan: প্রতিটা migration-এর সাথে reverse SQL document করব

---

## Rollout order (recommended)

```text
Today  → Phase 1 (realtime triage) — সবচেয়ে বড় unlock
Day 2  → Phase 2 (egress / select trim) — 30 file batch
Day 3  → Phase 3 (caching) + Phase 7 (debounce wire-up)
Day 4  → Phase 4 (retention migration) — 1 migration, approval needed
Day 5  → Phase 5 (vacuum/reindex) + Phase 6 (storage hygiene)
Day 6  → Phase 8 (edge cache) + final QA
```

---

## Approval needed

বলো কোনটা দিয়ে শুরু করব:
- **A** — Phase 1 (realtime, সবচেয়ে urgent for 500-user goal)
- **B** — পুরো 8 phase একসাথে (3-4 batch-এ)
- **C** — শুধু DB-side (Phase 4 + 5) — frontend touch করব না

Approve করলে শুরু করি।
