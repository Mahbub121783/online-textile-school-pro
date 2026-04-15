

# Workshop System — Full Implementation Plan

## Overview
Build a complete Workshop system (1-day or multi-day) with public pre-registration (no login required), admin management, countdown timers, Google Meet integration, material distribution, quizzes, and student dashboard integration.

## Database Schema (Migration)

### Table: `workshops`
Core workshop entity with fields:
- `id`, `title`, `slug` (unique), `description`, `short_description`, `thumbnail_url`
- `workshop_type` enum: `one_day`, `multi_day`
- `start_date`, `end_date`, `start_time`, `end_time`
- `meet_link` (Google Meet URL)
- `max_participants` (nullable = unlimited)
- `status` enum: `draft`, `published`, `ongoing`, `completed`, `cancelled`
- `is_featured`, `registration_deadline`
- `materials` JSONB array (name, url, type for downloadable instruments/resources)
- `instructor_name`, `instructor_bio`, `instructor_avatar`
- `prerequisites` text, `what_you_learn` JSONB array
- `created_by` (references auth.users), timestamps

### Table: `workshop_registrations`
- `id`, `workshop_id` (FK workshops), `user_id` (nullable — for guest registrations)
- `full_name`, `email`, `mobile`, `institution`
- `status` enum: `registered`, `attended`, `cancelled`, `no_show`
- `registration_number` (auto-generated like `WS-XXXXXX`)
- `checked_in_at`, timestamps
- Unique constraint on `(workshop_id, email)`

### Table: `workshop_sessions` (for multi-day)
- `id`, `workshop_id` (FK), `title`, `session_date`, `start_time`, `end_time`
- `meet_link` (can override main), `description`, `sort_order`

### Table: `workshop_quizzes`
- `id`, `workshop_id` (FK), `title`, `description`, `questions` JSONB
- `time_limit_minutes`, `is_active`, timestamps

### Table: `workshop_quiz_attempts`
- `id`, `quiz_id` (FK), `registration_id` (FK), `answers` JSONB
- `score`, `max_score`, `submitted_at`

RLS: Public read for published workshops. Public insert for registrations. Admin full access. Authenticated users can read their own registrations.

---

## New Pages & Components

### 1. Public Workshop Pages
- **`/workshops`** — `src/pages/static/WorkshopsPage.tsx`: Catalog of all published workshops with countdown timers, registration counts, status badges
- **`/workshops/:slug`** — `src/pages/static/WorkshopDetail.tsx`: Full detail page with:
  - Hero section with thumbnail, countdown to start
  - Registration form (name, email, mobile, institution — no login needed)
  - Schedule/sessions list for multi-day
  - Materials download section (available after registration)
  - Instructor info
  - Live registration count / slots remaining
  - Quiz section (if active, after workshop starts)

### 2. Student Dashboard
- **`/dashboard/workshops`** — `src/pages/dashboard/MyWorkshopsPage.tsx`: List of registered workshops with status, countdown, meet links, materials, and quiz access
- Add "My Workshops" to `DashboardSidebar.tsx` (visible to all users, no enrollment check)

### 3. Admin Workshop Management
- **`/admin/workshops`** — `src/pages/admin/AdminWorkshops.tsx`: Full CRUD with:
  - Workshop creation form (title, type, dates, meet link, materials upload, max participants)
  - Registration dashboard per workshop (count, registered profiles, export)
  - Session builder for multi-day workshops
  - Quiz builder (reuse existing quiz pattern)
  - Status management (draft → published → ongoing → completed)
  - Bulk actions (email all registrants, mark attendance)
- Add "Workshops" to `AdminSidebar.tsx` under the "Engagement" group

### 4. Profile Integration
- Show upcoming workshop registrations on `Profile.tsx` as a stats card

---

## Routes (App.tsx additions)
```text
/workshops                    → WorkshopsPage
/workshops/:slug              → WorkshopDetail
/dashboard/workshops          → MyWorkshopsPage
/admin/workshops              → AdminWorkshops
```

---

## Key Features per Component

**Countdown Timer**: Reusable component showing days/hours/minutes/seconds until workshop starts. Used on catalog cards, detail page, and dashboard.

**Registration Flow**: No login required. Simple form → insert into `workshop_registrations` → show confirmation with registration number. If logged in, auto-fill from profile and link `user_id`.

**Materials Distribution**: Admin uploads files via existing MediaPickerModal → stored in `materials` JSONB → downloadable from detail page and dashboard after registration.

**Quiz System**: Lightweight quiz builder in admin (JSONB questions array with MCQ format). Participants take quiz on the workshop detail page. Results stored in `workshop_quiz_attempts`.

**Meet Link**: Displayed only after registration and when workshop is ongoing. Hidden before start time.

**Admin Analytics**: Registration count, attendance rate, quiz completion stats per workshop.

---

## Technical Details

- Follows existing patterns: React Query for data, Supabase client, toast notifications, MediaPickerModal for uploads
- Countdown uses `date-fns` differenceInSeconds with `setInterval`
- Registration number generated via DB default: `'WS-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0')`
- Workshop notifications via existing `notifyAllStudentsWithEmail` on publish
- All pages use existing Header/Footer/BottomNav layout pattern
- Admin page uses Dialog-based forms matching existing admin patterns (scrollable, max-h-[90vh])

