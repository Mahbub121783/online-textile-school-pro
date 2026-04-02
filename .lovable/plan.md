

## Plan: Upgrade Instructor Portal to an Advanced System

### Current State Assessment

The instructor portal has 12 pages with basic CRUD functionality. Here is what exists and what is missing:

| Feature | Current State | Gap |
|---------|--------------|-----|
| Dashboard | 6 stat cards + course list | No charts, no time-range filters, no activity feed |
| Courses | Basic table, create/edit | No duplicate, no bulk actions, no analytics per course |
| Course Builder | 3-step wizard (Basics/Curriculum/Settings) | No drag-and-drop reorder for sections, no course preview modal, no auto-save |
| Curriculum Builder | Sections with lessons/quizzes/assignments/materials | No drag-and-drop sort (GripVertical icons are visual-only), no bulk publish/unpublish |
| Lessons | Read-only list with search | Cannot create/edit lessons from this page (must go to Course Builder) |
| Quizzes | Full CRUD + question management | No question bank import, no quiz duplication |
| Assignments | Full CRUD + grading | No rubric system, no bulk grading |
| Gradebook | Per-course student matrix | No export to CSV/Excel, no weighted grades, no overall GPA |
| Students | Enrollment manager + gradebook tab | No messaging, no student profile view, no bulk enroll via CSV |
| Certificates | View issued + template preview | Read-only (cannot create templates from instructor side) |
| Revenue | Stats + per-course breakdown + recent enrollments | No date-range filter, no charts, no payout history |
| Wallet | Balance, top-up, withdraw, transaction history | Functional but no withdrawal status tracking |
| Sidebar | 12 items, flat list | No grouping, no badge counts |
| Discussions | Database table exists | No instructor discussion page at all |
| Announcements | No table or page | Missing entirely |
| Course Analytics | None | No per-course engagement data |
| Bulk Operations | None | No bulk publish, delete, or export |

### Implementation Plan (Priority Order)

**Step 1: Enhanced Dashboard with Charts & Activity Feed**
- Add a mini line chart (recharts) showing enrollments over last 30 days
- Add recent activity feed (last 10 enrollments, submissions, quiz attempts)
- Add quick-action buttons (Create Course, View Revenue, Pending Reviews)
- Add date-range selector for stats

**Step 2: Discussion Forum for Instructors**
- New page: `InstructorDiscussions.tsx`
- List all discussions across instructor's courses, grouped by course
- Reply inline with threaded comments
- Mark as answered toggle
- New sidebar item + route

**Step 3: Course Announcements System**
- New DB table: `course_announcements` (id, course_id, instructor_id, title, content, is_pinned, created_at)
- New page: `InstructorAnnouncements.tsx` — create/manage announcements per course
- Students see announcements on course detail page and lesson player
- New sidebar item + route

**Step 4: Gradebook CSV Export & Weighted Grades**
- Add "Export CSV" button to gradebook
- Add weight configuration per assessment type (quiz weight, assignment weight)
- Show weighted final grade column

**Step 5: Course Analytics Page**
- New page: `InstructorAnalytics.tsx`
- Per-course: completion rate chart, lesson drop-off, quiz pass rate, average time spent
- Uses existing enrollment, lesson_progress, quiz_attempts data
- New sidebar item + route

**Step 6: Bulk Student Enrollment via CSV**
- Add CSV upload button in Students page
- Parse CSV (email/phone column), lookup users, bulk insert enrollments
- Show results summary (enrolled, not found, already enrolled)

**Step 7: Sidebar Grouping & Badge Counts**
- Group sidebar: Teaching (Courses, Lessons, Quizzes, Assignments), Students (Students, Gradebook, Discussions), Finance (Revenue, Wallet)
- Add unread count badges for discussions and pending submissions

**Step 8: Revenue Dashboard Charts**
- Add monthly revenue bar chart using recharts
- Add date-range filter (last 7d, 30d, 90d, all time)
- Add payout history section from wallet_transactions

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/instructor/InstructorDiscussions.tsx` | Discussion management |
| `src/pages/instructor/InstructorAnnouncements.tsx` | Course announcements |
| `src/pages/instructor/InstructorAnalytics.tsx` | Course analytics with charts |

### Files to Edit

| File | Changes |
|------|---------|
| `src/pages/instructor/InstructorDashboard.tsx` | Add charts, activity feed, quick actions |
| `src/pages/instructor/InstructorGradebook.tsx` | Add CSV export, weighted grades |
| `src/pages/instructor/InstructorStudents.tsx` | Add CSV bulk enroll |
| `src/pages/instructor/RevenueDashboard.tsx` | Add charts, date filter |
| `src/components/layout/InstructorSidebar.tsx` | Grouped nav, badge counts |
| `src/App.tsx` | Add 3 new routes (discussions, announcements, analytics) |

### Migration

```sql
CREATE TABLE course_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  instructor_id uuid NOT NULL,
  title text NOT NULL,
  content text,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE course_announcements ENABLE ROW LEVEL SECURITY;

-- Instructors manage own course announcements
CREATE POLICY "Instructors manage announcements" ON course_announcements
FOR ALL TO authenticated
USING (instructor_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
WITH CHECK (instructor_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Students view announcements for enrolled courses
CREATE POLICY "Students view announcements" ON course_announcements
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM enrollments e
  WHERE e.course_id = course_announcements.course_id
  AND e.user_id = auth.uid()
));
```

### Technical Notes
- Charts use `recharts` (already available in the project via shadcn chart component)
- CSV export uses browser-native Blob + download
- CSV import uses FileReader + Papa Parse (or manual split)
- All new pages follow existing patterns (useQuery + supabase + shadcn components)
- Total: 3 new files, 6 edited files, 1 migration. Estimated ~8 steps of implementation.

