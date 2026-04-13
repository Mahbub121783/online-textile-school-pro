

# Online Textile University -- Complete Feature Implementation PRD
## 8 Phases, 21 Features

---

## Phase 1: Academic Foundation
**Goal**: Establish core academic infrastructure that all subsequent features depend on.

### Features:
1. **Batch/Cohort System** -- Create `batches` table (name, start_date, end_date, status, max_students). Admin can create/manage batches, assign students to batches, filter by batch everywhere. Student profile shows batch. Batch-specific announcements. Admin sidebar gets "Batches" menu item.

2. **Academic Calendar** -- Create `academic_calendar` table (title, event_type [semester_start, exam_week, holiday, deadline], start_date, end_date, batch_id nullable, is_global). Admin CRUD with color-coded calendar view. Students see filtered calendar on dashboard. Public events page shows upcoming academic dates.

3. **Grade Point System (GPA/CGPA)** -- Create `grade_configs` table (letter_grade, min_pct, max_pct, grade_point, is_active). Create `student_grades` table (user_id, course_id, batch_id, letter_grade, grade_point, credits). Admin configures grading scale. Auto-calculate from quiz+assignment+manual marks. Student dashboard shows semester GPA and cumulative CGPA. Instructor gradebook shows letter grades.

### Admin Access:
- Full CRUD for batches, calendar events, grade configuration
- Assign/remove students from batches in bulk
- Override individual student grades

### Student Access:
- View assigned batch, academic calendar, GPA/CGPA on dashboard
- Semester-wise grade breakdown

### Notifications & Email:
- Email on batch assignment (`batch_assigned` template)
- Calendar event reminders (1 day before)
- Grade published notification

---

## Phase 2: Learning Engagement
**Goal**: Deepen student-content interaction.

### Features:
4. **Discussion per Lesson** -- Extend existing `discussions` table to support lesson-level threading. Add discussion panel inside LessonPlayer with reply chains, upvote, mark-as-answer. Instructor can pin/close threads. Real-time updates via Supabase realtime.

5. **Course Review & Rating** -- Create `course_reviews` table (user_id, course_id, rating 1-5, review_text, is_approved, created_at). Only enrolled students who completed >50% can review. Admin approval queue. Average rating updates on courses table. Display on course detail page with pagination.

6. **Peer Review System** -- Create `peer_reviews` table (assignment_submission_id, reviewer_user_id, rubric_scores jsonb, feedback, created_at). Admin/instructor configures peer review for assignments (min reviewers, rubric criteria). System auto-assigns reviewers from enrolled students. Reviewer dashboard in student panel.

### Admin Access:
- Moderate all discussions, approve/reject reviews, configure peer review rules

### Student Access:
- Post questions per lesson, rate completed courses, review peers' assignments

### Notifications & Email:
- Notify instructor on new lesson question
- Email when review is approved/rejected
- Notify student when assigned as peer reviewer

---

## Phase 3: Live Learning
**Goal**: Real-time classroom experience.

### Features:
7. **Live Class / Zoom + Meet Integration** -- Create `live_classes` table (course_id, batch_id, title, description, meeting_url, platform [zoom/meet/custom], start_time, duration_minutes, recording_url, status). Admin/instructor creates sessions with Zoom/Meet links. Student dashboard shows upcoming live classes with join button (auto-enabled 10 min before). Calendar integration. Recording link post-session.

8. **Attendance System** -- Create `attendance_records` table (live_class_id, user_id, check_in_time, check_out_time, status [present/absent/late/excused], marked_by). Instructor marks attendance during/after live class. Bulk mark from enrolled list. Student sees attendance percentage on dashboard. Admin sees attendance analytics per batch/course.

### Admin Access:
- Create/edit/cancel live classes across all courses
- View attendance reports with export to CSV
- Set attendance percentage thresholds

### Student Access:
- View upcoming classes, join via link, see personal attendance record

### Notifications & Email:
- Email 1 hour before live class (`live_class_reminder` template)
- Notify when recording is available
- Weekly attendance summary email

---

## Phase 4: Communication & Language
**Goal**: Reach every student in their language.

### Features:
9. **Multi-language Support (Bengali + English)** -- Implement i18n using `react-i18next`. Create `public/locales/en/` and `public/locales/bn/` translation JSON files. Language toggle in header (EN/BN). Store preference in user_profiles (`preferred_language` column). Translate all UI labels, buttons, navigation, dashboard headings, and static pages. Admin can set default site language.

10. **SMS Notifications** -- Create `sms_logs` table. Create `send-sms` edge function supporting providers (e.g., generic HTTP API). Admin configures SMS provider credentials in setup. SMS templates for critical events (OTP, class reminder, result published). Admin can compose bulk SMS. Student can opt-in/out of SMS in settings.

11. **Faculty/Staff Directory** -- Create `faculty_members` table (name, designation, department, bio, photo_url, email, phone, specialization, sort_order, is_active). Admin CRUD. Public `/faculty` page with search/filter by department. Link to instructor profiles where applicable.

### Admin Access:
- Manage translations, SMS templates, faculty directory
- Set default language, SMS provider configuration

### Student Access:
- Toggle language, manage SMS preferences, browse faculty directory

### Notifications & Email:
- SMS for live class reminders, grade published, payment due
- Language-aware email templates (send in user's preferred language)

---

## Phase 5: Academic Integrity & Assessment
**Goal**: Ensure academic quality.

### Features:
12. **Plagiarism Checker** -- Create `plagiarism_reports` table (submission_id, similarity_pct, matched_sources jsonb, checked_at). Edge function that compares assignment text against other submissions in same assignment (internal similarity detection using text hashing/shingling). Display similarity score on instructor's grading view. Flag submissions above threshold (configurable by admin).

13. **Student Transcript Generator** -- Create `/dashboard/transcript` route. Pull all completed courses, grades, GPA/CGPA, credits. Generate professional PDF transcript with university branding (logo, name, address from id_card_settings). Include student photo, roll ID, batch. Admin can generate for any student. Digital verification QR code linking to verification endpoint.

14. **Group Projects** -- Create `project_groups` table (course_id, name, max_members). Create `project_group_members` table. Create `project_submissions` table. Instructor creates groups (manual or auto-assign). Students see group dashboard with shared submission area. Group-level grading. Discussion thread per group.

### Admin Access:
- Configure plagiarism thresholds, generate transcripts for any student, manage group project settings

### Student Access:
- View plagiarism report on own submissions, download transcript, collaborate in groups

### Notifications & Email:
- Email when plagiarism flagged (to instructor)
- Notify group members on new submission/comment
- Email transcript download link

---

## Phase 6: Career & Research
**Goal**: Beyond-classroom value.

### Features:
15. **Internship Management** -- Create `internships` table (title, company, description, requirements, stipend, duration, application_deadline, status, posted_by). Create `internship_applications` table. Admin/industry partners post internships. Students apply with cover letter + resume. Application tracking pipeline (applied -> shortlisted -> interviewed -> offered -> rejected). Dashboard widget for active internship.

16. **Research Paper Repository** -- Create `research_papers` table (title, abstract, authors jsonb, file_url, category, keywords, published_date, download_count, submitted_by). Students/faculty submit papers for admin approval. Public browse/search with filters. Download tracking. Citation export (BibTeX format).

17. **Virtual Lab Simulations** -- Create `virtual_labs` table (title, description, course_id, simulation_url, type [iframe/external], instructions, is_published). Admin/instructor adds simulation links (iframe embeds or external URLs to existing textile simulation platforms). Student accesses from lesson player or dedicated `/labs` page. Track completion.

### Admin Access:
- Full CRUD for internships, approve research papers, manage lab simulations

### Student Access:
- Apply to internships, submit research papers, access virtual labs

### Notifications & Email:
- Email on internship application status change
- Notify when new paper is published in student's field
- Lab assignment notification

---

## Phase 7: Financial Flexibility
**Goal**: Remove payment barriers.

### Features:
18. **Payment Plans / Installments** -- Create `payment_plans` table (course_id, total_amount, installment_count, interval_days). Create `installment_payments` table (plan_id, user_id, installment_number, amount, due_date, paid_at, status). Admin creates installment options per course. Student selects plan at checkout. Dashboard shows upcoming payments. Auto-reminder emails before due dates. Late payment handling (grace period, access suspension).

19. **Multi-currency Support** -- Create `currencies` table (code, name, symbol, exchange_rate, is_active). Admin sets base currency and exchange rates. Course prices auto-convert based on student's selected currency. Currency selector in header/footer. Store original + converted amounts in orders table. Admin can update exchange rates.

20. **Analytics Dashboard for Students** -- New `/dashboard/analytics` route. Charts showing: study time per week, course completion velocity, quiz score trends, assignment grades over time, attendance rate, GPA progression. Compare with batch average (anonymized). Weekly progress email with key metrics.

### Admin Access:
- Configure payment plans, manage currencies/exchange rates, view aggregate student analytics

### Student Access:
- Choose installment plans, select currency, view personal analytics dashboard

### Notifications & Email:
- Installment due reminder (3 days before, on due date, overdue)
- Currency rate change notification to admin
- Weekly analytics summary email to students

---

## Phase 8: Intelligence & Polish
**Goal**: AI-powered features and final integration.

### Features:
21. **AI Tutor Chatbot** -- Create `ai_chat_sessions` table (user_id, course_id, messages jsonb, created_at). Edge function proxying to AI API (using LOVABLE_API_KEY). Context-aware: knows student's enrolled courses, current lesson, recent quiz scores. Floating chat widget (separate from existing support chat). Suggest resources, explain concepts, quiz prep. Admin can configure behavior rules and restrict to specific courses.

### Final Integration Tasks:
- **Cross-feature notification audit**: Ensure every feature sends proper notifications (in-app + email + SMS where configured)
- **Admin super-dashboard**: Aggregate widgets from all 21 features on admin dashboard
- **Student profile completeness**: Update ProfileCompletenessWidget to include new fields (batch, language, transcript, attendance)
- **Mobile responsiveness**: Audit all new pages for mobile/tablet layouts
- **Performance optimization**: Lazy-load all new routes, optimize queries with proper indexes

### Admin Access:
- Configure AI behavior, view all chat logs, set feature toggles for each module

### Student Access:
- AI tutor chat, fully integrated profile with all features accessible

### Notifications & Email:
- Final audit: all 25+ email templates working with proper placeholders
- SMS fallback for critical notifications
- In-app notification center shows all feature events

---

## Technical Architecture Summary

### New Database Tables (across all phases):
`batches`, `batch_students`, `academic_calendar`, `grade_configs`, `student_grades`, `course_reviews`, `peer_reviews`, `live_classes`, `attendance_records`, `sms_logs`, `faculty_members`, `plagiarism_reports`, `project_groups`, `project_group_members`, `project_submissions`, `internships`, `internship_applications`, `research_papers`, `virtual_labs`, `payment_plans`, `installment_payments`, `currencies`, `ai_chat_sessions`

### New Edge Functions:
`send-sms`, `check-plagiarism`, `generate-transcript`, `ai-tutor`

### New Routes (~25):
Admin: batches, calendar, grade-config, reviews, live-classes, attendance, faculty, internships, research, labs, payment-plans, currencies, ai-config
Student: transcript, analytics, internships, research, labs, groups
Public: faculty, labs

### Implementation Order Rationale:
Phase 1-2 build the academic data model everything else depends on. Phase 3 adds live interaction. Phase 4 removes language barriers. Phase 5-6 add academic depth. Phase 7 removes financial barriers. Phase 8 ties everything together with AI and polish.

Each phase is independently deployable and testable. No phase breaks existing functionality.

