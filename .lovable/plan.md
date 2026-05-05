# Plan: Verify Double-Submit Guards & Live Data Refresh

## Goal
1. Prove `QuizPlayer` cannot double-submit and `ReelSlot`/`ChatWidget` cannot double-count views/messages, via automated integration tests.
2. Provide a repeatable way to verify every page is pulling fresh Supabase data (no hidden cache locks).

---

## Part 1 — Integration Tests (Vitest + React Testing Library)

Existing setup (`vitest.config.ts`, `src/test/setup.ts`) is ready. Add:

### A. `src/pages/quiz/__tests__/QuizPlayer.test.tsx`
Covers `submitRef` guard:
- Mock `@/integrations/supabase/client` (quizzes, quiz_questions, quiz_attempts, attempts list).
- Mock `useAuth` → fake user, `useParams` → quizId.
- Render inside `QueryClientProvider` + `MemoryRouter`.
- Answer questions, click **Submit Quiz** twice rapidly + trigger timer-zero submit.
- Assert `supabase.from('quiz_attempts').insert` called **exactly once**.
- Second test: anti-cheat auto-submit + manual submit → still 1 insert.

### B. `src/components/class-videos/__tests__/ReelSlot.test.tsx`
Covers `viewCounted` ref:
- Mock IntersectionObserver, mock supabase RPC/insert for views.
- Simulate the same video entering viewport 3 times.
- Assert view-increment call fires once per video id.

### C. `src/components/chat/__tests__/ChatWidget.test.tsx`
Covers send-message guard + drag ref:
- Mock supabase insert for chat messages and AI gateway call.
- Click **Send** twice while first request pending → assert insert called once.
- Simulate drag start/stop sequence → assert no spurious click handler fires (open/close not toggled).

### D. Test utility
Add `src/test/utils.tsx` with `renderWithProviders()` (QueryClient + MemoryRouter + minimal AuthProvider mock) to keep tests DRY.

Run via `bunx vitest run`.

---

## Part 2 — Live Data Refresh Audit

### B1. Static audit script (one-off, dev-only)
Add `scripts/audit-query-cache.ts` (run with `bun scripts/audit-query-cache.ts`) that:
- Greps `src/**/*.{ts,tsx}` for `useQuery(` blocks.
- Reports any with `staleTime: Infinity`, `enabled: false` permanently, or `refetchOnMount: false` overrides.
- Prints a table: file → query key → staleTime → refetchOnMount.
- Flags hooks that override the safe global defaults set in `src/App.tsx`.

This is a developer tool (not shipped to users) — output goes to console.

### B2. Runtime "Freshness Probe" page (admin-only)
Add `src/pages/admin/AdminDataFreshness.tsx` route `/admin/data-freshness`:
- Lists every major data source (notifications, courses, ebooks, instructors, stats, hero slides, testimonials, sponsors, popups, forum posts, class videos, workshops, learning paths).
- Each row shows: last fetch timestamp, row count, "Refetch now" button.
- Uses `queryClient.getQueryCache()` to read live React Query state — no extra DB load unless user clicks refetch.
- Confirms in real time which queries are stale/fresh and lets admin force-invalidate any of them.

Add link in `AdminSidebar` under existing "System" section.

### B3. Notification realtime smoke test
Add a "Test Notification" button on `/admin/data-freshness` that inserts a row into `notifications` for the current admin user → verifies the realtime subscription added in `useNotifications` fires within 2s (visible toast + bell badge increments without refresh).

---

## Files to add/edit

**New:**
- `src/test/utils.tsx`
- `src/pages/quiz/__tests__/QuizPlayer.test.tsx`
- `src/components/class-videos/__tests__/ReelSlot.test.tsx`
- `src/components/chat/__tests__/ChatWidget.test.tsx`
- `scripts/audit-query-cache.ts`
- `src/pages/admin/AdminDataFreshness.tsx`

**Edited:**
- `src/App.tsx` — register `/admin/data-freshness` route (lazy)
- `src/components/layout/AdminSidebar.tsx` — add nav entry

---

## Free-tier safety
- Tests are local — zero Supabase calls (all mocked).
- Freshness page reads cached React Query state by default; DB hits only on explicit "Refetch" click.
- Audit script is grep-only, no network.
- No changes to global staleTime / refetchOnMount — current "5 min stale + background refetch + notification realtime" balance preserved.

Approve korle implement korbo.