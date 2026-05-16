# Merge Practice Arena with Student Identity & Dashboard

## Clarification first

Practice Arena already uses the **same `auth.uid()` / `user_profiles` / `roll_id`** as the rest of the site — no new user IDs were created. What feels "separate" is:

1. Practice stats live in their own tables (`qb_user_stats`, `qb_exam_sessions`) and are only visible inside `/practice/*` pages.
2. The student dashboard (`/dashboard/*`) has no widget, page, or sidebar link for Practice Arena.
3. The leaderboard shows `full_name` but not `roll_id` prominently, so it looks like a separate identity.

This plan unifies the experience — no schema rename, no duplicate IDs, just surfacing existing data inside the student panel and tightening identity display.

---

## 1. Student Dashboard — Practice Widget (Overview)

Add a new `PracticeWidget.tsx` in `src/pages/dashboard/` showing:
- Total XP, current streak, longest streak (from `qb_user_stats`)
- Exams taken / passed / pass-rate
- Latest badge earned
- Best department + best difficulty
- CTA buttons: **Continue Practice** → `/practice`, **View History** → `/dashboard/practice-history`, **Leaderboard** → `/practice/leaderboard`

Mount it in `DashboardOverview.tsx` alongside `GpaWidget` / `LiveClassesWidget`.

## 2. Student Dashboard — Dedicated Practice Pages

New routes inside `/dashboard`:
- `/dashboard/practice` — full stats page: XP progression chart, per-department breakdown (Yarn / Fabric / Wet / Apparel), per-difficulty breakdown, badges grid, recent 10 exams table with score/percentage/passed/date.
- `/dashboard/practice-history` — paginated list of all exam sessions (reuses logic from `PracticeHistory.tsx` but in dashboard layout).
- `/dashboard/practice-leaderboard` — embedded leaderboard with the user's own rank highlighted.

Add corresponding entries in the student `DashboardLayout` sidebar under a new **"Practice Arena"** group (or under "Academic").

## 3. Identity unification

- `PracticeLeaderboard.tsx`: display **Roll ID** next to the name (already fetched) and link the row to the user's public profile (`/u/:username`) — same pattern used elsewhere.
- `PracticeHome.tsx` header: greet user by name + roll ID + show their current XP/streak inline (pulled from `qb_user_stats`) so the user clearly sees it's the same account.
- Add a "View in Dashboard" link from `/practice` → `/dashboard/practice`.

## 4. Student ID Card extension

`StudentIdCard.tsx` already shows roll ID. Add a small **Practice XP / Streak** chip on the back of the card (or under the QR) so the unified identity is visible on the printed/PNG export.

## 5. Profile public page (`/u/:username`)

Add a "Practice Stats" section: total XP, badges, best department, leaderboard rank. Reuses `qb_user_stats` + `qb_leaderboard_cache` keyed by `user_id` (which is already the same `user_profiles.id`).

---

## Technical details

**No schema changes needed.** Everything keys off existing `auth.uid()` / `user_profiles.id`.

Files to create:
- `src/pages/dashboard/PracticeWidget.tsx`
- `src/pages/dashboard/PracticePage.tsx` (full stats)
- `src/pages/dashboard/PracticeHistoryPage.tsx` (dashboard-wrapped)
- `src/pages/dashboard/PracticeLeaderboardPage.tsx` (dashboard-wrapped)

Files to edit:
- `src/pages/dashboard/DashboardOverview.tsx` — mount `PracticeWidget`
- `src/App.tsx` — register 3 new `/dashboard/practice*` routes
- `src/components/dashboard/DashboardSidebar*.tsx` (or equivalent) — add Practice Arena nav group
- `src/pages/practice/PracticeHome.tsx` — header greeting with roll ID + XP/streak chip + "View in Dashboard" link
- `src/pages/practice/PracticeLeaderboard.tsx` — show roll ID + link to public profile
- `src/components/student/StudentIdCard.tsx` — XP/streak chip
- `src/pages/PublicProfile.tsx` (or equivalent `/u/:username` page) — Practice Stats section

All data comes from existing RPCs / tables; no new RLS work.

---

## Out of scope (unless you confirm)

- Renaming/dropping `qb_user_stats` into `user_profiles` columns (not needed — it's already 1:1 by `user_id`).
- Changing how XP/streak is calculated.
- Merging practice "rank" with course "GPA" — they remain separate metrics.

Confirm and I'll implement.
