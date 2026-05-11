## Problem

`AdminQuestionBank` page exists and is lazy-imported in `App.tsx` but:
1. **No `<Route>` is registered** → opening any URL 404s.
2. **No entry in `AdminSidebar.tsx`** → admin can't discover it.
3. The page only has 5 basic tabs (Subjects, Questions, Bulk, AI, AI Settings). After the gamification + integrity migration we now have rich data (`qb_exam_sessions`, `qb_exam_violations`, `qb_user_stats`, `qb_badges`, `qb_user_badges`) with **no admin UI**, so it doesn't feel "advanced".

## Plan

### 1. Make it accessible
- Add route in `src/App.tsx` under the admin layout: `/admin/question-bank` and `/admin/question-bank/:tab` → `AdminQuestionBank`.
- Add a new **collapsible sidebar group "Brain Test"** in `AdminSidebar.tsx` (icon: `Brain`) with sub-items:
  - Subjects → `/admin/question-bank/subjects`
  - Questions → `/admin/question-bank/questions`
  - AI Generate → `/admin/question-bank/ai`
  - Live Sessions → `/admin/question-bank/sessions`
  - Violations → `/admin/question-bank/violations`
  - Badges → `/admin/question-bank/badges`
  - Analytics → `/admin/question-bank/analytics`
  - Settings → `/admin/question-bank/ai-settings`
- Insert the group right after "Academic" so it sits with the learning tools.

### 2. Refactor `AdminQuestionBank.tsx` for advanced UX
- Convert the page to read the active tab from `useParams().tab` (like `AdminInstructors.tsx`) so each sub-item deep-links cleanly and is bookmarkable.
- Add a sticky page header with KPI strip: total questions, total exams taken (today / 7d), avg score, integrity violations (24h), active live sessions. All from cheap `count: 'exact', head: true` queries.
- Restyle existing tabs (cleaner cards, search bar for Questions, CSV export of selected questions, multi-select bulk delete / activate).

### 3. New advanced tabs (frontend only, reading existing tables)

**Live Sessions** (`qb_exam_sessions` where `status='in_progress'`)
- Auto-refreshing table (10s) showing student, subject, started_at, time elapsed, last heartbeat age, violation count, focus mode flag, resume count.
- Row turns amber if heartbeat > 60s, red if > 120s.
- Action buttons: View details (modal with answers so far + violations), Force-submit (calls existing `qb_submit_exam` RPC).

**Violations** (`qb_exam_violations`)
- Filterable list by violation type, date range, student.
- Aggregated chart: violations per type (last 30 days) using simple bars.
- Click row → drawer with full session context.

**Badges** (`qb_badges` + `qb_user_badges`)
- Catalog grid with icon, name, criteria JSON, earned-count.
- Add/Edit badge modal (name, description, icon emoji, criteria JSON, xp_reward, is_active toggle).
- "Top earners" mini-leaderboard per badge.

**Analytics**
- Cards: exams per day (sparkline), pass rate %, avg time-to-complete, hardest questions (lowest correct-rate), most-attempted subjects.
- Top 10 students by total XP (`qb_user_stats`).
- All charts use lightweight inline SVG / recharts already installed.

### 4. Polish
- Consistent breadcrumb at top: Admin → Brain Test → {tab label}.
- Mobile: tabs collapse into a Select dropdown (already a project pattern).
- Respect existing dark teal / terracotta theme tokens — no hard-coded colors.

## Out of scope
- New DB tables or RPCs (everything reads tables created in the previous migration).
- Editing the student-facing exam UI.
- Email/SMS alerts for violations (can come later).

## Files to change
- `src/App.tsx` — register `/admin/question-bank/:tab?` route.
- `src/components/layout/AdminSidebar.tsx` — add "Brain Test" collapsible group.
- `src/pages/admin/AdminQuestionBank.tsx` — switch to `useParams` tab, add KPI header, refactor existing tabs.
- New: `src/pages/admin/question-bank/LiveSessionsTab.tsx`
- New: `src/pages/admin/question-bank/ViolationsTab.tsx`
- New: `src/pages/admin/question-bank/BadgesTab.tsx`
- New: `src/pages/admin/question-bank/AnalyticsTab.tsx`
