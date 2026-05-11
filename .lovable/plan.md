
# Question Bank & Practice Exam System

A standalone "Brain Test" module — fully separate from course quizzes. Logged-in students subject + level select korbe, system random 25 Q diye exam toiri korbe, instant result + explanation + leaderboard + full attempt history.

## 1. Database (new tables)

- **qb_subjects** — name, slug, icon, description, sort_order, is_active
- **qb_topics** — subject_id, name, slug, description, sort_order (lesson-equivalent grouping)
- **qb_questions**
  - subject_id, topic_id (nullable)
  - difficulty: enum `basic | intermediate | advanced`
  - question_type: `multiple_choice | true_false | short_answer`
  - question_text, options (jsonb), correct_answer, explanation
  - points (default 1), tags (text[]), source ('manual' | 'bulk' | 'ai')
  - created_by, is_active, times_used, correct_rate
- **qb_exam_sessions** — user_id, subject_id, topic_id (nullable), difficulty, question_ids (uuid[]), started_at, submitted_at, time_taken_seconds, score, total, percentage, passed
- **qb_exam_answers** — session_id, question_id, selected_answer, is_correct, time_spent_seconds
- **qb_leaderboard_cache** — user_id, period ('all_time'|'monthly'|'weekly'), subject_id (nullable), total_exams, avg_percentage, total_points, rank (refreshed via pg_cron)

RLS:
- Students: read active subjects/topics/questions (correct_answer/explanation hidden until submission via SECURITY DEFINER fn), full CRUD on own sessions/answers
- Admin/instructor: full CRUD on subjects/topics/questions
- Leaderboard cache: public read

DB function `start_exam(subject, topic?, difficulty)` → server-side picks 25 random active questions, creates session, returns sanitized questions (no answers). `submit_exam(session_id, answers[])` → grades, updates session + question stats.

## 2. Student-facing UI (`/practice`)

```
/practice                  → Subject grid (icons, question counts, "Your best %")
/practice/:subject         → Topic list + 3 difficulty cards (Basic/Intermediate/Advanced) with available Q count and "Start Exam" CTA
/practice/exam/:sessionId  → Exam runner (25 Q, optional timer, progress bar, prev/next, flag, auto-save)
/practice/result/:sessionId→ Score breakdown, per-Q correct/wrong with explanation, retry CTA
/practice/history          → User's all attempts with filters (subject, difficulty, date)
/practice/leaderboard      → Tabs: All-time / Monthly / Weekly • filter by subject • top 100 + own rank
```

Dashboard sidebar gets a "Practice / Brain Test" link. Profile shows total practice exams + avg score badge.

## 3. Admin/Instructor UI

New admin route `Admin → Question Bank` with tabs:
- **Subjects & Topics** — CRUD tree
- **Questions** — table with filters (subject, topic, difficulty, type, source), inline edit, bulk delete, activate/deactivate
- **Add Question** — single-form modal (reuses `QuizBuilderModal` patterns)
- **Bulk Import** — CSV/Excel uploader with template download, server-side validation, preview before commit, per-row error report
- **AI Generator** — Choose subject/topic/difficulty/count → calls `qb-ai-generate` edge function (Lovable AI Gateway, Gemini Flash) → review screen → bulk approve into bank
- **Analytics** — most-missed questions, low-quality flags (correct_rate <20% or >95%)

Same UI exposed to instructors with RLS scoping (only their own contributed questions editable).

## 4. Edge Functions

- `qb-bulk-import` — parses uploaded CSV/XLSX (already have parser deps), validates, inserts in batches of 500
- `qb-ai-generate` — input {subject, topic, difficulty, count, language} → returns draft question array (JSON schema enforced)
- `qb-leaderboard-refresh` — pg_cron hourly refresh of `qb_leaderboard_cache`

## 5. Mechanics

- 25 Q per session (configurable per-difficulty in admin settings)
- Optional timer (default: Basic 20m, Intermediate 25m, Advanced 30m)
- Pass mark 60% (configurable)
- Anti-cheat lite: questions order shuffled per session, options shuffled per render, no answer key sent until submit
- Streak tracking (consecutive days with ≥1 exam) shown on history page
- React Query keys: `qb-subjects`, `qb-topics-{subject}`, `qb-question-counts`, `qb-session-{id}`, `qb-leaderboard-{period}-{subject}`

## 6. Bulk-import CSV format

```
subject_slug,topic_slug,difficulty,question_type,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,points,tags
```

Downloadable template button + sample rows.

## 7. Out of scope (future)

- Adaptive difficulty
- Paid subscription gating
- Per-question discussion thread
- Mock exam mode (mixed subjects, longer)

---

## Technical notes

- All new tables `qb_*` namespaced to avoid collision with existing `quizzes` (course-tied)
- `start_exam`/`submit_exam` SECURITY DEFINER Postgres functions to keep correct_answer server-side
- AI generation uses `LOVABLE_API_KEY` (already provisioned), structured output via tool calling
- Bulk import uses streaming parse to handle 5–6k rows safely
- Leaderboard cache + indexes: `(subject_id, difficulty, percentage desc)` on sessions, `(period, total_points desc)` on cache
- Reuses existing shadcn primitives, Dark Teal & Terracotta theme tokens, `useAuth`, React Query defaults
