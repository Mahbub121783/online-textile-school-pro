

# Fix Academic System Integration Gaps

## Analysis of Current State

| Feature | Status | Gap |
|---------|--------|-----|
| Student Attendance | Exists but basic | No trends chart, no weekly/monthly visualization, no date filtering |
| Instructor Grading | Exists and functional | No bulk grading, no attendance data in gradebook context |
| Batch-aware Calendar | Already works | Calendar widget already filters by student batch -- no change needed |
| Instructor Plagiarism | Missing entirely | Only admin has plagiarism page; instructors cannot check their own students |
| Student Group Projects | Basic | No R2 file upload, no comments/discussion, no deadline tracking |

## What We Will Build

### 1. Enhanced Student Attendance Page (`AttendancePage.tsx`)
- Add date range filter (this week / this month / all time)
- Add a weekly attendance trend chart using Recharts (bar chart: present vs absent per week)
- Add course filter dropdown to view one course at a time
- Show streak indicator (consecutive present days)

### 2. Instructor Plagiarism Checker (`InstructorPlagiarism.tsx` -- NEW)
- Instructor sees only submissions from their own courses
- Can run the same shingling-based check that admin uses
- Filter by course, assignment, and status (clean/flagged/pending)
- View similarity details and matched sources
- Add nav item under "Students" group in InstructorSidebar
- Add route in App.tsx

### 3. Enhanced Group Projects Page (`GroupProjectsPage.tsx`)
- Integrate `useFileUpload` for R2-based file submission instead of manual URL
- Add a comment thread per submission (using existing `project_submissions` or inline state)
- Show deadline from group's `deadline` field with countdown
- Show group progress (submissions count vs expected)

### 4. Minor Gradebook Enhancement (`InstructorGradebook.tsx`)
- Add attendance rate column per student (query `attendance_records` for the course's live classes)
- Show a visual indicator if attendance is below 75%

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/pages/dashboard/AttendancePage.tsx` | Add trends chart, date filter, course filter, streak |
| `src/pages/instructor/InstructorPlagiarism.tsx` | **New** -- instructor plagiarism checker |
| `src/pages/dashboard/GroupProjectsPage.tsx` | Add R2 upload, deadlines, progress |
| `src/pages/instructor/InstructorGradebook.tsx` | Add attendance rate column |
| `src/components/layout/InstructorSidebar.tsx` | Add "Plagiarism" nav item under Students |
| `src/App.tsx` | Add `/instructor/plagiarism` route |

No database migration needed -- all tables already exist.

