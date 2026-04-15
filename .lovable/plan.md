

# CMS Section Deep Audit — Issues & Fixes

## Issues Found

### 1. Route Conflict: `cms/:tab` Catches `cms/courses/new` and `cms/courses/:courseId`
**File: `src/App.tsx` lines 260-263**
React Router v6 matches the **most specific** path, so `cms/courses/new` WILL match correctly over `cms/:tab`. However, `cms/:tab` matches `courses` as a tab parameter — so clicking "Create Course" navigates to `/admin/cms/courses/new` which works. **No bug here** — React Router 6 handles specificity correctly.

### 2. Assignment Grading Does NOT Notify Students (Critical)
**File: `src/pages/admin/course-management/AssignmentTab.tsx` lines 76-81**
When an admin grades an assignment submission, only the DB record is updated. The student receives **no notification** that their assignment was graded and scored. This is a significant UX gap — students have to manually check.

**Fix**: After `gradeSubmission` mutation succeeds, send a notification to the student with their score and feedback.

### 3. Quiz Results "Justify & Re-rank" Does NOT Notify Students
**File: `src/pages/admin/course-management/QuizResultsBoard.tsx` lines 103-134**
When an admin overrides quiz scores via the Justify dialog, the student gets no notification about the score change.

**Fix**: After `saveFeedback` mutation succeeds, send notification to the student.

### 4. Gradebook Manual Mark Does NOT Notify Students
**File: `src/pages/admin/course-management/GradebookTab.tsx` lines 149-166**
When admins add or update manual marks, students are not notified.

**Fix**: After `saveManualMark` mutation succeeds, send notification.

### 5. No Query Limits on Several CMS Queries
Multiple queries across CMS tabs lack `.limit()`, risking silent truncation at 1000 rows:
- `GradebookTab.tsx`: `enrollments`, `quiz_attempts`, `submissions`, `manualMarks` queries
- `QuizDashboard.tsx`: `questionCounts`, `attemptCounts` queries (fetch ALL quiz_questions and quiz_attempts)
- `CoursesListTab.tsx`: courses query
- `LessonMakerTab.tsx`: lessons, sections, quizzes, assignments queries

**Fix**: Add `.limit(5000)` to prevent silent truncation.

### 6. Course Delete is Actually "Archive" But No Real Delete Option
**File: `CoursesListTab.tsx` lines 89-95**
The "delete" mutation just sets `is_published: false, review_status: 'draft'`. The dropdown says "Archive" which is correct, but there's no way to permanently delete a course. This is acceptable behavior but worth noting.

### 7. QuizBuilder Deletes All Questions on Edit (Destructive)
**File: `QuizBuilder.tsx` line 181**
When editing an existing quiz, ALL questions are deleted and re-inserted: `await supabase.from('quiz_questions').delete().eq('quiz_id', quizId!)`. This means if the save fails partway, existing questions are lost. Not ideal but works for small question sets.

### 8. Certificate Assignment Uses `as any` Type Cast
**File: `CourseSettingsTab.tsx` line 93**
`await supabase.from('courses').update({ cert_template_id: templateId } as any)` — indicates `cert_template_id` might not be in the generated types. This works at runtime but is a type safety gap.

## Implementation Plan

### Step 1: Add Student Notifications on Assignment Grading
**File: `src/pages/admin/course-management/AssignmentTab.tsx`**
- In `gradeSubmission.onSuccess`, look up the submission's `user_id` and send a notification with score and feedback

### Step 2: Add Student Notifications on Quiz Score Override
**File: `src/pages/admin/course-management/QuizResultsBoard.tsx`**
- In `saveFeedback.onSuccess`, send notification to the student about their updated score

### Step 3: Add Student Notifications on Manual Mark
**File: `src/pages/admin/course-management/GradebookTab.tsx`**
- In `saveManualMark.onSuccess`, send notification to the student

### Step 4: Add Query Limits Across CMS Tabs
**Files**: `GradebookTab.tsx`, `QuizDashboard.tsx`, `CoursesListTab.tsx`, `LessonMakerTab.tsx`
- Add `.limit(5000)` to all queries that currently lack limits

## Files Modified
1. `src/pages/admin/course-management/AssignmentTab.tsx` — Grade notification + query limits
2. `src/pages/admin/course-management/QuizResultsBoard.tsx` — Score override notification
3. `src/pages/admin/course-management/GradebookTab.tsx` — Manual mark notification + query limits
4. `src/pages/admin/course-management/QuizDashboard.tsx` — Query limits
5. `src/pages/admin/course-management/CoursesListTab.tsx` — Query limits
6. `src/pages/admin/course-management/LessonMakerTab.tsx` — Query limits

No database migrations needed — all notification tables and functions already exist.

