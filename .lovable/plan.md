## Root cause summary

After scanning 179 files using `useQuery` / `supabase.from`, the database overload is **not** an infinite loop in a single component. It is **a small number of high-frequency polling + duplicate realtime channels + un-bounded scan queries** firing per user, multiplied across every concurrent visitor. With every request also writing to Supabase logs, this is exactly what fills disk and exhausts compute.

Below is the prioritized hit-list with the exact files and lines, followed by the fix plan.

## Top offenders (ordered by request volume)

### P0 — ChatWidget polling storm
`src/components/chat/ChatWidget.tsx`
- L461–513 `chat-conversations`: **polls every 5 s while open**, and the query reads ALL `chat_messages` for the user (no limit) plus `chat_requests` plus `user_profiles` — 3 round trips per poll.
- L516–545 `chat-requests`: polls every 5 s while open + extra `user_profiles` lookup.
- L562–574 `chat-messages`: polls every 3 s when a thread is open.
- L393, L420, L448 — three realtime channels are also subscribed for the same data (chat_messages, chat_requests, presence). So you have polling AND realtime for the same rows. One must go.
- All three channel names use `Date.now()` in the key (L393/L420/L448). On every re-render with changing deps (`open`, `selectedUser?.userId`), a brand-new channel is opened. Combined with React StrictMode/double-mount, this leaks subscriptions.

Per logged-in user with chat open and a thread selected: ~`60/3 + 60/5 + 60/5 = 44` queries per minute, each doing 2–3 sub-queries. That alone is enough to swamp a small instance.

### P1 — Public homepage `StatsSection`
`src/components/features/home/StatsSection.tsx` L55–58
- 4 `count(*)` style queries (`user_roles`, `courses`, `user_profiles`, `courses` again) on every cold visitor. `count: 'exact'` is a full table scan on Postgres.
- staleTime is 1h, but every new browser/incognito hits it fresh. With bots / SEO crawlers, this can dominate.

### P1 — `useNotifications` shared hook on every layout
`src/hooks/useNotifications.ts` L28–48
- 10-minute `refetchInterval` × every authenticated tab. Fine in isolation, but combined with the realtime invalidation in `useRealtime.ts` it can still re-trigger continuously.
`src/hooks/useRealtime.ts` L19–24
- Subscribes to `notifications INSERT` **without a `user_id` filter**, so every notification anywhere in the system invalidates the query in every connected client → cascade refetches.

### P2 — InstructorSidebar badge poller
`src/components/layout/InstructorSidebar.tsx` L81–100
- `refetchInterval: 60000` runs a 2-step query (`courses` → `discussions count`) every minute for every instructor tab, even when sidebar is hidden on mobile.

### P2 — DashboardOverview small-but-wasteful queries
`src/pages/dashboard/DashboardOverview.tsx`
- L24–31 `cert-count`: `SELECT id` of all certificates just to `.length` it.
- L33–40 `referral-count`: same anti-pattern.
- These should be `count: 'exact', head: true` or moved to a single RPC.

### P2 — `usePopupEngine` analytics insert on every popup view/click
`src/hooks/usePopupEngine.tsx` L106–118
- One INSERT into `popup_analytics` per view/click — fine, but no debounce; combined with auto-fire popups can spam if a popup re-renders.

### P3 — `useExamHeartbeat` 20 s RPC
`src/hooks/useExamHeartbeat.ts`
- `qb_heartbeat` RPC every 20 s during exams. OK if exams are rare; investigate if many sessions are stuck "active" and never released (zombie heartbeats fill logs).

## Fix plan

```text
Phase A — Stop the bleeding (largest impact)
  1. ChatWidget: keep ONE realtime channel (messages+requests),
     remove all three refetchInterval pollers.
  2. ChatWidget: stable channel keys (drop Date.now()) and gate
     subscriptions on `open && user?.id` only.
  3. ChatWidget chat-conversations: limit messages query
     (e.g. last 200 rows) and select only needed columns.

Phase B — Reduce per-page query weight
  4. StatsSection: collapse 4 queries into one RPC
     get_public_stats() returning JSON; cache 1h server-side.
  5. DashboardOverview cert-count / referral-count: switch to
     `count: 'exact', head: true` (no row payload).
  6. InstructorSidebar badge: same head-count pattern + bump
     refetchInterval to 5 min, disable when sidebar collapsed.

Phase C — Tame realtime fanout
  7. useRealtime notifications channel: filter by current user_id
     so other users' inserts don't invalidate everyone.
  8. useNotifications: drop the 10-min interval — realtime already
     invalidates; rely on it + refetchOnMount when truly needed.

Phase D — Logging hygiene
  9. Audit any DB triggers / functions that RAISE NOTICE on every
     insert (Postgres log spam fills disk fastest); convert to
     RAISE DEBUG.
 10. Verify no UPDATE-without-WHERE or recursive trigger exists on
     hot tables (notifications, chat_messages, popup_analytics).
```

## Technical details

- All proposed changes are frontend-only except items 4 (one new RPC) and 9–10 (DB-side log hygiene). No schema changes required.
- React Query global config is already conservative (`refetchOnMount:false`, `staleTime:2m`, `refetchOnWindowFocus:false`), so the fix is targeted at per-query overrides, not global tuning.
- Realtime channels must use **stable keys** (`chat-rt-${user.id}`, not `…-${Date.now()}`) so refcounting / dedupe works the same way `useNotifications` already does.
- After Phase A ships, expected per-user steady-state DB request rate drops from ~44/min (chat open) to ~1/min (idle realtime keepalive only).

Approve this and I will implement Phase A + B in one pass, then Phase C, then queue Phase D as a DB migration once the instance is responsive again.