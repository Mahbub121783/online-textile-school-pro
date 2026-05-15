## Goal
Recover login and data loading without a Supabase upgrade by cutting the new quiz/practice load that is overwhelming the database and by making the app survive temporary DB timeouts.

## What I found
- The database is still timing out at the infrastructure layer: even `select now()` fails with `544 Connection terminated due to connection timeout`.
- The quiz/practice rollout added several heavy client-side query patterns that can easily amplify a weak Supabase instance:
  - `PracticeHome` loads all active `qb_questions` rows just to count by subject/difficulty.
  - `PracticeSubject` loads question rows to compute difficulty counts instead of doing cheap counts.
  - `AdminQuestionBank` runs 4 KPI count queries on mount and some tabs poll/live-refresh aggressively.
  - `LiveSessionsTab` polls every 10 seconds.
  - `AnalyticsTab` pulls up to 2000 submitted sessions plus more quiz tables client-side.
  - `QuizDashboard` scans up to 5000 `quiz_questions` and `quiz_attempts` rows just to compute counts.
  - Admin/Instructor realtime listeners still invalidate a very wide set of queries globally.
- So this is not “only Supabase is broken”; the current app is also over-requesting after the quiz system changes.

## Plan
### 1) Stop the quiz-system query storm
Refactor the heaviest quiz/practice/admin screens so they do not scan large tables on page load.
- `PracticeHome`
  - remove full-table `qb_questions` fetch for counts
  - temporarily replace global stats and per-subject counts with lighter/fallback values when DB is stressed
- `PracticeSubject`
  - replace difficulty-row fetch with cheaper count strategy and stricter query enabling
- `AdminQuestionBank`
  - make only the active tab fetch data
  - disable KPI auto-refresh during emergency mode
  - stop background queries for tabs the user is not viewing
- `LiveSessionsTab`
  - remove 10s polling and switch to manual refresh or much slower refresh only when the tab is open
- `AnalyticsTab`
  - stop pulling large result sets during normal admin navigation; use a degraded summary mode for now
- `QuizDashboard`
  - remove 5000-row scans for question/attempt counts and fall back to on-demand or per-quiz detail loading

### 2) Reduce global realtime pressure
Narrow global subscriptions so non-quiz pages are not constantly invalidating caches.
- `useAdminRealtime`
  - stop subscribing to broad quiz/forum/order tables all at once
  - keep only the most essential invalidations for current route groups or disable emergency-unnecessary subscriptions
- `useInstructorRealtime`
  - trim to the minimal set needed for instructor UI
- keep notification dedupe, but avoid extra invalidations during saturation

### 3) Make auth and shared data resilient during DB timeouts
Ensure users can still enter the app shell even if profile/settings queries fail.
- `useAuth`
  - remove any non-essential role/profile sync that can block recovery
  - prefer cached profile/roles first and refresh lazily in background
  - avoid extra realtime role subscription during emergency mode
- `useSettings` and `useCurrency`
  - add local fallback cache so header/footer/public pages can render even when Supabase fails
- prevent repeated retries from hammering the DB while it is already degraded

### 4) Add an emergency load-shedding switch for quiz/practice features
Create a small central emergency mode helper used by the heavy quiz/practice/admin modules.
- when enabled, expensive counts, polling, analytics, and broad refreshes are disabled automatically
- keep core flows usable: login, dashboard shell, basic admin access, question CRUD, quiz attempt submission
- show safe fallback UI states instead of infinite loading or repeated error loops

### 5) Validate the recovery path
After the code changes, verify that:
- login no longer hangs waiting on profile/settings/currency queries
- homepage/public shell does not spam failed requests
- admin and instructor layouts do not subscribe broadly on every page
- quiz/practice pages fetch only what they need when opened
- no new console/runtime errors are introduced

## Technical notes
- I will keep this as a code-hardening pass first, without requiring a paid Supabase upgrade.
- I will avoid database schema changes unless they become strictly necessary after the app-side load shedding.
- If the database remains fully saturated immediately after the hardening, the app still may need a little time for the IO budget to recover, but the new code will stop re-burning it.

## Expected result
- Data loading should start recovering once the current timeout state clears.
- The app should stop self-amplifying the outage.
- Quiz/practice/admin features will remain usable in a reduced but stable mode instead of taking the whole app down.