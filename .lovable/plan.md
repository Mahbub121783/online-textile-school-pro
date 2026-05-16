## Goal

Practice Arena ke major restructure korbo: 10 ta subject → **4 ta department** (Yarn, Fabric, Wet, Apparel), 30 questions ekbare load (single-single na), bulk CSV export, leaderboard + analytics fix, ar "All Departments" mix mode add.

---

## 1. Database migration

**Department mapping** (existing subjects → new departments):
- **Yarn** = Yarn engineering + Yarn Technology + Spinning
- **Fabric** = Weaving + Knitting
- **Wet** = Dyeing & Finishing
- **Apparel** = Garments Technology + Merchandising + Quality Control + Textile Management

Steps:
1. Insert 4 notun subjects: `Yarn`, `Fabric Manufacturing`, `Wet Processing`, `Apparel & Management` (slugs: yarn, fabric, wet, apparel).
2. `UPDATE qb_questions SET subject_id = <new_dept_id>` — old → new mapping.
3. Old 10 subjects ke `is_active=false` set kore archive (delete na, history bachano er jonno).
4. `qb_exam_sessions.subject_id` gulo same way migrate kora (history e dekha jabe).
5. `qb_leaderboard_cache` truncate (auto regenerate hobe).

**Difficulty-wise leaderboard:**
- `qb_leaderboard_cache` te already `subject_id` ache → notun column **`difficulty qb_difficulty NULL`** add. Unique key adjust.
- `qb_refresh_leaderboard()` function rewrite: ranking buckets per `(period, subject_id, difficulty)` — so user difficulty + department filter kortei alada ranking.

**Question count rule:**
- `qb_start_exam` default `_question_count` 25 → **30**. Frontend o 30 pathabe.

**All-Departments mix:**
- Notun RPC `qb_start_mixed_exam(_difficulty, _question_count=30)` — 4 department theke proportionally random (~7-8 per dept), session e `subject_id` NULL save korbe (currently NOT NULL — make nullable).

---

## 2. Exam UI — 30 Q at once

`src/pages/practice/PracticeExam.tsx`:
- Currently probably single-question paginated. Refactor to **single scrollable page** — sob 30 ta question ekbare visible, each with radio options.
- Top-e sticky progress bar + countdown timer.
- Right side floating "Question palette" (1-30 grid) — click → scroll to that Q. Answered = green dot, unanswered = grey.
- "Submit Exam" button bottom-e + sticky top corner-e.

---

## 3. Practice Home reorganization

`PracticeHome.tsx`:
- **Top-e (most prominent):** "All Departments Challenge" big card — Mixed 30Q from all 4 depts, choose difficulty → start.
- Below: 4 department cards (Yarn, Fabric, Wet, Apparel) in 2x2 grid, big icons, color-coded.
- Remove old 10-subject grid.

`PracticeSubject.tsx`: update icon/color theme per department, still shows 3 difficulty (Basic/Intermediate/Advanced) → 30 Q.

---

## 4. Leaderboard fix

`PracticeLeaderboard.tsx`:
- Add **Difficulty filter** (All / Basic / Intermediate / Advanced) alongside existing Period + Department filter.
- Query `qb_leaderboard_cache` with `(period, subject_id, difficulty)` matching.
- "All Departments" + "All Difficulty" = grand leaderboard.
- Fix current bug: likely `subject_id is null` filter not matching properly — verify and fix.

---

## 5. Bulk CSV export (Admin)

Admin Question Bank-e notun **"Export"** button:
- File: `src/pages/admin/question-bank/ExportTab.tsx` (or button in existing tab).
- Filter: by department + difficulty (or all).
- Generate CSV columns: `subject_name, difficulty, question_type, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, points, source`.
- Client-side: fetch all matching rows in pages of 1000, build CSV blob, download as `question-bank-export-YYYYMMDD.csv`.

---

## 6. Admin Analytics enhancement

`src/pages/admin/question-bank/AnalyticsTab.tsx`:
- Add new section: **"All Users — Exam Stats"** table.
- Columns: User (name + roll_id), Total Exams, Passed, Avg %, Total XP, Current Streak, Last Practice Date.
- Sortable. Pagination 50/page.
- Source: join `qb_user_stats` + `user_profiles` + `qb_exam_sessions` aggregates.
- Top XP card already ache — extend kore full table karbo.

---

## Technical details

**Files to edit:**
- `supabase/migrations/...` — new migration (subjects insert, question remap, leaderboard col, RPC updates)
- `src/pages/practice/PracticeHome.tsx` — 4-dept layout + mixed CTA
- `src/pages/practice/PracticeExam.tsx` — all-30-at-once UI
- `src/pages/practice/PracticeLeaderboard.tsx` — difficulty filter
- `src/pages/admin/question-bank/AnalyticsTab.tsx` — user stats table
- `src/pages/admin/question-bank/ExportTab.tsx` — new file (CSV export)
- `src/pages/admin/QuestionBank.tsx` (or wherever tabs live) — add Export tab

**Open issue check during implementation:** confirm exact bug causing leaderboard + "All Subjects" to not work (likely the `.is('subject_id', null)` filter against rows that never got null inserted, plus session schema NOT NULL on subject_id).

---

## Out of scope

- Notun question authoring (existing ~3000 just regrouped).
- Topic-level filtering UI.
- Multilingual support.

Confirm korle implementation shuru korbo.