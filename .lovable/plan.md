

# Advanced Internship Management System

## Current State
- Basic `internships` table with title, company, description, requirements, stipend, duration, deadline, status, is_published
- Basic `internship_applications` table with cover_letter, resume_url, status, admin_notes
- Simple public listing page with search and apply dialog
- Admin page with CRUD and basic application status management
- No instructor involvement, no student dashboard view, no advanced features

## What We Will Build

### Database Migration

**1. Extend `internships` table:**
- `location` (text) -- city/remote
- `internship_type` (text: onsite/remote/hybrid)
- `department` (text) -- department/category
- `positions_available` (integer, default 1)
- `positions_filled` (integer, default 0)
- `skills_required` (text[]) -- skills tags
- `contact_email` (text)
- `supervisor_id` (uuid, references user_profiles) -- assigned instructor supervisor
- `is_featured` (boolean, default false)
- `view_count` (integer, default 0)

**2. Extend `internship_applications` table:**
- `portfolio_url` (text)
- `skills` (text[]) -- applicant's matching skills
- `availability_date` (date)
- `interview_date` (timestamptz)
- `interview_notes` (text)
- `rating` (integer 1-5) -- admin/instructor rating
- `reviewed_by` (uuid) -- who reviewed

**3. New table: `internship_tasks`** -- track intern progress
- `id`, `internship_id`, `application_id`, `title`, `description`, `status` (pending/in_progress/completed/reviewed), `due_date`, `submitted_at`, `submission_url`, `feedback`, `assigned_by`, `created_at`

**4. New table: `internship_logs`** -- daily/weekly log entries
- `id`, `application_id`, `user_id`, `log_date`, `hours_worked`, `activities`, `learnings`, `supervisor_feedback`, `created_at`

### Frontend: 7 Major Components

**5. Enhanced Public Internship Catalog** (`/internships` -- rewrite)
- Advanced filters: type (onsite/remote/hybrid), department, skills, stipend range
- Featured internships section at top
- Detailed internship detail view (requirements, skills, supervisor info)
- Real file upload for resume via `useFileUpload` (R2)
- Multi-step application: Personal Info -> Skills Match -> Resume Upload -> Cover Letter -> Submit

**6. Student Dashboard: My Internships** (`/dashboard/internships`)
- Active applications with status timeline (Applied -> Shortlisted -> Interviewed -> Offered/Rejected)
- Accepted internship workspace: task list, daily log submission, progress tracking
- Interview schedule calendar
- Upload work submissions for assigned tasks

**7. Instructor Internship Supervision** (`/instructor/internships`)
- View internships assigned to them as supervisor
- Review applications (rate, provide feedback, shortlist)
- Assign tasks to accepted interns
- Review daily logs and provide feedback
- Track intern progress with completion stats

**8. Enhanced Admin Panel** (`/admin/internships` -- rewrite)
- Dashboard stats: total internships, active applications, positions filled, acceptance rate
- Full pipeline: create internship -> assign supervisor -> review apps -> schedule interviews -> offer/reject
- Assign instructor supervisors to internships
- Bulk actions on applications
- Export applicant data (CSV)
- Integration with registration system: link internship registration purposes to specific internships

**9. Internship Detail Page** (`/internships/:id`)
- Full description, requirements, skills needed, supervisor profile
- Application form or status badge
- Related internships
- View count tracking

### Integration Points
- **Registration System**: Admin can create a registration purpose linked to an internship for external applicants
- **Notifications**: Notify student on status change, instructor on new assignment, admin on new application
- **File Upload**: Resume/portfolio upload via existing R2 `useFileUpload`
- **Navigation**: Add "My Internships" to DashboardSidebar, "Internships" to InstructorSidebar

## Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Extend `internships` + `internship_applications`, create `internship_tasks` + `internship_logs` |
| `src/pages/static/InternshipsPage.tsx` | Complete rewrite -- advanced catalog with filters |
| `src/pages/static/InternshipDetail.tsx` | **New** -- detailed internship page |
| `src/pages/dashboard/MyInternshipsPage.tsx` | **New** -- student internship dashboard |
| `src/pages/instructor/InstructorInternships.tsx` | **New** -- supervisor interface |
| `src/pages/admin/AdminInternships.tsx` | Full rewrite -- workflow dashboard with stats |
| `src/components/layout/DashboardSidebar.tsx` | Add "My Internships" nav item |
| `src/components/layout/InstructorSidebar.tsx` | Add "Internships" nav item |
| `src/App.tsx` | Add new routes |

