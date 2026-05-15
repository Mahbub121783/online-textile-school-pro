## Status
স্ক্রিনশট অনুযায়ী **Phase 2 এখনো complete হয়নি** — SQL Editor-এ এখনও `Connection terminated due to connection timeout` আসছে, মানে database saturation এখনো আছে। তাই bulk index script একসাথে run করলে timeout হওয়াই expected.

## What I checked
- `qb_questions`-এর জন্য কিছু base index **আগেই আছে**:
  - `idx_qb_questions_pick (subject_id, difficulty, is_active)`
  - `idx_qb_questions_topic (topic_id)`
- `qb_exam_sessions`-এর জন্যও base index **আগেই আছে**:
  - `idx_qb_sessions_user (user_id, submitted_at DESC)`
  - `idx_qb_sessions_leaderboard (subject_id, difficulty, percentage DESC)`
- App code scan অনুযায়ী heavy filters বেশি হচ্ছে এইগুলায়:
  - `notifications(user_id, is_read / created_at)`
  - `quiz_attempts(quiz_id, user_id, started_at/completed_at)`
  - `quizzes(course_id)`
  - `quiz_questions(quiz_id)`
  - `qb_exam_answers(session_id)`
  - `qb_exam_sessions(status)`

## Plan
1. **Bulk SQL বন্ধ** — সব index এক query-তে run না করে one-by-one run করতে হবে.
2. **Highest-impact indexes আগে** run করতে হবে এই order-এ:
   - `notifications(user_id, is_read)` partial unread index
   - `notifications(user_id, created_at DESC)`
   - `quiz_attempts(quiz_id, user_id)` বা `quiz_id, user_id, started_at DESC`
   - `quiz_questions(quiz_id)`
   - `quizzes(course_id)`
   - `qb_exam_answers(session_id)`
   - `qb_exam_sessions(status)`
3. **Already-covered quiz-bank indexes skip** — `qb_questions subject/difficulty/topic` আর `qb_exam_sessions user/leaderboard` duplicate করে লাভ কম.
4. **Low-traffic window-তে run** — user activity কম থাকলে query timeout chance কমবে.
5. **Per-index verification** — প্রতিটা successful run-এর পর next index. Failed হলে same index পরে retry.
6. **Only after DDL succeeds** then Phase 2.2 / 2.3:
   - `qb_stats_cache`
   - aggregate/RPC `get_practice_overview()`

## Technical details
```text
Priority order
1. notifications unread/read paths
2. quiz_attempts joins/history paths
3. quiz_questions lookup paths
4. quizzes course lookup paths
5. qb_exam_answers session detail paths
6. qb_exam_sessions status count paths
```

## Expected outcome
- Admin notifications and quiz dashboards first improve করবে
- Practice-related IO কিছুটা কমবে without redoing indexes that already exist
- Database responsive হলে next phase-এ cache/table/function add করা যাবে