

## Gap Analysis (instructor portal vs admin CMS)

| Module | Admin CMS has | Instructor portal has | Gap |
|---|---|---|---|
| **Lessons** | Full builder (628 LOC): video/text/quiz/assignment types, multi-platform video (YouTube/Vimeo/Drive/R2), preview toggle, scheduled unlock, status workflow, resources, attached quizzes/assignments via picker, rich text editor, MediaUploader | 95-LOC read-only list — instructor cannot create/edit lessons standalone, only via CourseBuilder | **Massive** |
| **Quizzes** | `QuizDashboard` + full `QuizBuilder` (447 LOC): multi-question types, drag reorder, results board, analytics, time limits, shuffle, retake rules | 268-LOC basic CRUD, no question reordering, no results dashboard, no preview | Large |
| **Assignments** | `AssignmentTab` (332 LOC): rubric, file types allowed, plagiarism integration, bulk grade, return-revision flow, attachments | 262-LOC basic CRUD + grade dialog | Medium |
| **Course CMS** | `CoursesListTab`: review workflow, approve/reject, bulk actions, publish toggle, duplicate, soft-delete | Simple list, links to `CourseBuilder` only | Medium |
| **eBooks** | `AdminEbooks` (587 LOC): full upload, R2/Cloudinary, contributor picker, pricing, DRM settings, stats | **None — instructors cannot create or manage ebooks at all** | **Critical** |

## Plan — Bring instructor CMS to admin parity

### 1. Reuse, don't duplicate (DRY)
Extract admin CMS tabs into **role-aware shared components** that filter data by `instructor_id` when `mode='instructor'` and skip admin-only actions (approve/reject, force-publish, cross-instructor bulk).

| New shared component | Replaces |
|---|---|
| `src/components/cms/LessonMaker.tsx` | Wraps logic from `admin/course-management/LessonMakerTab.tsx`, adds `scope: 'admin' \| 'instructor'` prop. Instructor mode auto-filters courses to `instructor_id = user.id` and removes "all courses" view. |
| `src/components/cms/QuizManagement.tsx` | Wraps `QuizDashboard` + `QuizBuilder` + `QuizResultsBoard` flow with same `scope` prop. |
| `src/components/cms/AssignmentManagement.tsx` | Wraps `AssignmentTab`. |
| `src/components/cms/EbookManagement.tsx` | Wraps `AdminEbooks` core (form, upload, contributor picker). Instructor mode: only see/edit own ebooks (filter `created_by = user.id`); admin sees all. |
| `src/components/cms/CourseListing.tsx` | Wraps `CoursesListTab`. Instructor mode: own courses only, no approve/reject buttons (those stay admin-only), keeps create/edit/duplicate/preview/delete. |

### 2. Wire upgraded shared components into instructor pages

| Instructor file | Change |
|---|---|
| `InstructorLessons.tsx` | Replace 95-LOC list → `<LessonMaker scope="instructor" />` (full CRUD, video/text/assignment/quiz lessons, preview, schedule, resources) |
| `InstructorQuizzes.tsx` | Replace dialog form → `<QuizManagement scope="instructor" />` (dashboard + builder + results board) |
| `InstructorAssignments.tsx` | Replace → `<AssignmentManagement scope="instructor" />` (rubric, file types, return-for-revision, bulk grade) |
| `InstructorCourses.tsx` | Replace plain table → `<CourseListing scope="instructor" />` (search/filter, duplicate, soft-delete, status tabs Draft/Pending/Published) |

### 3. Add eBook authoring for instructors (NEW)

DB migration:
- Add `ebooks.created_by uuid REFERENCES user_profiles(id)` (nullable for back-compat) + RLS policy: instructors can SELECT/INSERT/UPDATE/DELETE only ebooks where `created_by = auth.uid()`; admins keep full access.
- Backfill: `UPDATE ebooks SET created_by = (first matching contributor with role='author' from content_contributors)` where possible.

New pages/routes:
- `src/pages/instructor/InstructorEbooks.tsx` — uses `<EbookManagement scope="instructor" />`
- Route `/instructor/ebooks` in `App.tsx`
- Sidebar item "eBooks" under Teaching group in `InstructorSidebar.tsx`

Instructor-mode constraints in `EbookManagement`:
- Auto-set `created_by = user.id` on insert
- Hide global-only fields (admin moderation toggles)
- Pre-fill self as `lead author` in contributor picker

### 4. CourseBuilder enhancement
Currently `CourseBuilder.tsx` (437 LOC) is OK but missing feature parity with admin. Add:
- "Lessons" tab inside builder using same `<LessonMaker scope="instructor" courseId={id} />` (so instructors can manage lessons either inside a course context or globally)
- "Quizzes" tab → `<QuizManagement scope="instructor" courseId={id} />`
- "Assignments" tab → `<AssignmentManagement scope="instructor" courseId={id} />`

### 5. RLS audit (one migration)
Verify and add as needed:
- `lessons`, `course_sections`, `quizzes`, `quiz_questions`, `assignments` — instructors can manage rows where parent course `instructor_id = auth.uid()` OR they are listed in `content_contributors` with role `lead_instructor`/`co_instructor`.
- `ebooks` — new `created_by` policy as above.

## Result

- Instructors get the **exact same powerful CMS** as admin: full lesson maker, quiz builder with results board, assignment management with rubric/grading, ebook authoring.
- Single source of truth — admin and instructor share components via `scope` prop, so future improvements ship to both at once.
- Admin retains exclusive abilities (approve/reject courses, edit any user's content, moderate ebooks).
- Co-instructors and contributors (from previous feature) get same permissions via RLS.

## Files Touched

**New** (7):
- `src/components/cms/LessonMaker.tsx`
- `src/components/cms/QuizManagement.tsx`
- `src/components/cms/AssignmentManagement.tsx`
- `src/components/cms/EbookManagement.tsx`
- `src/components/cms/CourseListing.tsx`
- `src/pages/instructor/InstructorEbooks.tsx`
- One migration (ebooks.created_by + RLS)

**Edited** (8):
- `src/pages/instructor/InstructorLessons.tsx`
- `src/pages/instructor/InstructorQuizzes.tsx`
- `src/pages/instructor/InstructorAssignments.tsx`
- `src/pages/instructor/InstructorCourses.tsx`
- `src/pages/instructor/CourseBuilder.tsx`
- `src/components/layout/InstructorSidebar.tsx` (add eBooks link)
- `src/App.tsx` (add `/instructor/ebooks` route)
- `src/pages/admin/course-management/LessonMakerTab.tsx`, `QuizManagementTab.tsx`, `AssignmentTab.tsx`, `CoursesListTab.tsx`, `src/pages/admin/AdminEbooks.tsx` — refactored to import shared CMS components with `scope="admin"` (zero behavior change)

