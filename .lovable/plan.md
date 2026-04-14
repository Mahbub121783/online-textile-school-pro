
# Make Academic System More Advanced & Strong

## Current State
The academic system has basic implementations: Batches, GPA/CGPA widget, Academic Calendar, Attendance (admin-only), Plagiarism (admin-only), Project Groups (admin-only), and Grade Config. However, several critical integrations are missing.

## Gaps Identified
1. **No student-facing attendance page** -- students can't see their own attendance history
2. **Instructors can't assign grades** -- only admins can via AdminGradeConfig; InstructorGradebook is read-only
3. **Academic Calendar not batch-aware** for students -- shows all events regardless of batch
4. **No semester/term management** -- semesters are just free-text strings
5. **No student Project Groups view** -- only admin can see/manage
6. **Batch doesn't link to courses** -- no auto-enrollment or course assignment per batch
7. **No academic progress summary** (semester-wise GPA breakdown) on student dashboard

## Plan

### 1. Student Attendance Page (`src/pages/dashboard/AttendancePage.tsx`)
- Show all live classes the student attended with status (Present/Absent/Late/Excused)
- Overall attendance rate with visual progress ring
- Per-course attendance breakdown
- Add "Attendance" nav item to DashboardSidebar

### 2. Instructor Grade Assignment (enhance `InstructorGradebook.tsx`)
- Add an "Assign Grade" button per student row that opens a dialog
- Dialog lets instructor pick letter grade from `grade_configs`, enter semester, credits, notes
- Upserts into `student_grades` table (same as admin flow)
- Show existing grade if already assigned

### 3. Batch-Aware Academic Calendar Widget (update `AcademicCalendarWidget.tsx`)
- Fetch student's batch IDs from `batch_students`
- Filter calendar events: show global events + events matching student's batch IDs
- Sort by start_date, limit to 5

### 4. Student Group Projects Page (`src/pages/dashboard/GroupProjectsPage.tsx` -- enhance existing)
- Check if existing GroupProjectsPage already works; if stub, flesh it out
- Show groups the student belongs to, group members, project details, submission status

### 5. Semester-Wise GPA Breakdown (enhance `GpaWidget.tsx`)
- Group grades by semester
- Show per-semester GPA alongside CGPA
- Add a small expandable section showing semester breakdown

### 6. Batch-Course Linking (new DB table + admin UI enhancement)
- New `batch_courses` table: `batch_id`, `course_id` (many-to-many)
- Admin can assign courses to batches from the Batch management page
- Students in a batch see "Batch Courses" in their dashboard

## Database Migration
```sql
CREATE TABLE IF NOT EXISTS public.batch_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.batches(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(batch_id, course_id)
);
ALTER TABLE public.batch_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view batch_courses"
  ON public.batch_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage batch_courses"
  ON public.batch_courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
```

## Files to Create/Modify
| File | Change |
|------|--------|
| `src/pages/dashboard/AttendancePage.tsx` | **New** -- student attendance view |
| `src/components/layout/DashboardSidebar.tsx` | Add Attendance nav item |
| `src/pages/instructor/InstructorGradebook.tsx` | Add grade assignment dialog per student |
| `src/pages/dashboard/AcademicCalendarWidget.tsx` | Batch-aware filtering |
| `src/pages/dashboard/GpaWidget.tsx` | Semester-wise GPA breakdown |
| `src/pages/dashboard/GroupProjectsPage.tsx` | Enhance with full student view |
| `src/pages/admin/AdminBatches.tsx` | Add course assignment to batches |
| `src/App.tsx` | Add `/dashboard/attendance` route |
| Migration SQL | Create `batch_courses` table |
