

# Comprehensive Gap Analysis & Fix Plan

## Audit Summary

After thorough codebase and database analysis, here is every gap between the PRD and current implementation, organized by severity.

---

## CRITICAL GAPS (Missing Core Functionality)

### 1. Checkout: No Installment/Payment Plan Integration
- Admin can create payment plans (`AdminPaymentPlans.tsx` exists), but `Checkout.tsx` has zero integration -- students cannot select installment plans at checkout
- No student-facing installment dashboard showing upcoming payments, due dates, overdue alerts
- **Fix**: Add payment plan selection in Checkout, create student installment tracker in dashboard

### 2. Multi-Currency Not Integrated in Cart/Checkout
- `AdminCurrencies.tsx` exists and `currencies` table has data, but cart/checkout/course catalog show no currency selector and do not convert prices
- **Fix**: Add currency selector in Header/Footer, store preference, convert prices site-wide

### 3. No SMS Edge Function or Admin SMS Compose
- `sms_logs` table exists but no `send-sms` edge function, no admin SMS compose UI, no student SMS opt-in/out
- **Fix**: Create edge function, add admin bulk SMS compose, add SMS preference toggle in student settings

### 4. Transcript Missing QR Verification
- `TranscriptPage.tsx` generates PDF but has no QR code with digital verification endpoint
- **Fix**: Add QR code generation (using a library) linking to a public verification route

### 5. `courses.review_count` Column Missing
- `avg_rating` exists but `review_count` is not on the `courses` table -- no automatic aggregation trigger when reviews are approved
- **Fix**: Add column + database trigger to auto-update `avg_rating` and `review_count` on review insert/update

### 6. Peer Review Auto-Assignment Missing
- `peer_review_config` table exists but no logic auto-assigns reviewers from enrolled students when instructor enables peer review
- **Fix**: Add auto-assignment logic when instructor configures peer review for an assignment

---

## MODERATE GAPS (Feature Incomplete)

### 7. LessonPlayer Discussions: No Realtime
- Discussion Q&A works but has no Supabase Realtime subscription -- new posts don't appear without page refresh
- **Fix**: Add realtime channel subscription for lesson discussions

### 8. Course Review: No 50% Completion Gate
- PRD requires students must complete >50% of course to leave a review -- currently no check exists in `CourseDetail.tsx`
- **Fix**: Check `enrollments.progress_pct >= 50` before showing review form

### 9. Student Dashboard: Missing Installments Widget
- No widget for upcoming installment payments on the dashboard overview
- **Fix**: Add installment due dates widget to `DashboardOverview.tsx`

### 10. Admin Dashboard: Not Aggregating All 21 Features
- Dashboard shows users, courses, enrollments, revenue, orders -- missing widgets for: batches, attendance rate, plagiarism flags, active internships, research papers, live classes today, AI chat sessions
- **Fix**: Add aggregate stat cards for all major feature areas

### 11. Calendar Event Reminders Not Implemented
- Academic calendar events exist but no automated reminder (1 day before) via email/notification
- **Fix**: Add a scheduled edge function or trigger for calendar reminders

### 12. Grade Published Notification Missing
- When instructor publishes grades in gradebook, no notification/email is sent to the student
- **Fix**: Add notification call in grade save mutation

### 13. Attendance Weekly Summary Email Missing
- PRD specifies weekly attendance summary email -- not implemented
- **Fix**: Add scheduled email via edge function

### 14. Live Class Recording Notification Missing
- When `recording_url` is added to a live class, students are not notified
- **Fix**: Add notification trigger when recording URL is updated

---

## MINOR GAPS (Polish & Integration)

### 15. ProfileCompletenessWidget Not Updated
- Doesn't account for new fields: batch assignment, language preference, transcript availability, attendance status
- **Fix**: Update completeness calculation in `useProfileCompleteness.ts`

### 16. Language-Aware Email Templates
- i18n works for UI but email templates always send in English -- no check of `preferred_language`
- **Fix**: Add language check in `send-smtp-email` edge function

### 17. Group Project: No Discussion Thread Per Group
- `GroupProjectsPage.tsx` has submissions and file upload but no comment/discussion thread per group
- **Fix**: Add inline comment system using `project_submissions` or a new `project_comments` approach

### 18. Virtual Lab Completion Tracking Missing
- `virtual_labs` table exists, admin CRUD exists, public page exists -- but no student completion tracking
- **Fix**: Create `virtual_lab_completions` table or use existing lesson_progress pattern

---

## WHAT'S ALREADY WORKING (No Changes Needed)

| Feature | Status |
|---------|--------|
| Batch/Cohort System | Complete -- admin CRUD, student assignment, batch widget |
| Academic Calendar | Complete -- admin CRUD, student dashboard widget, batch filtering |
| Grade Point System | Complete -- config, student grades, GPA/CGPA widget |
| Discussion per Lesson | Complete -- threading, upvotes, pin, close, mark-as-answer |
| Course Review & Rating | Mostly complete -- submit, admin moderation (missing completion gate) |
| Peer Review System | Mostly complete -- manual assignment works (missing auto-assign) |
| Live Classes | Complete -- Zoom/Meet links, join button, calendar integration |
| Attendance System | Complete -- instructor marking, student view, trends chart, streak |
| Multi-language (i18n) | Complete -- EN/BN toggle, user preference saved |
| Faculty Directory | Complete -- admin CRUD, public page |
| Plagiarism Checker | Complete -- admin + instructor pages, shingling algorithm |
| Transcript Generator | Mostly complete (missing QR verification) |
| Group Projects | Mostly complete (missing group discussion) |
| Internship Management | Complete -- advanced pipeline, tasks, logs, supervisor |
| Research Paper Repository | Complete -- submission, approval, reader, citations |
| Virtual Labs | Mostly complete (missing completion tracking) |
| Payment Plans (Admin) | Complete admin CRUD (missing checkout integration) |
| Currencies (Admin) | Complete admin CRUD (missing frontend integration) |
| Student Analytics | Complete -- charts, scores, progress |
| AI Tutor Chatbot | Complete -- edge function, floating widget, context-aware |

---

## Implementation Plan

### Phase A: Database Migration
- Add `review_count` to `courses` table
- Create trigger to auto-update `avg_rating` and `review_count` when reviews change
- Create `virtual_lab_completions` table (user_id, lab_id, completed_at)

### Phase B: Checkout & Payment Integration (Highest Impact)
1. Add installment plan selection to `Checkout.tsx` -- query `payment_plans` for cart courses, let student choose full or installment
2. Create student installment tracker page or widget
3. Add currency selector component to Header, store in user profile, convert prices in cart/catalog

### Phase C: Notifications & Email Gaps
1. Add grade published notification in `InstructorGradebook.tsx` save mutation
2. Add live class recording notification when `recording_url` is set
3. Add review completion gate (50% progress check) in `CourseDetail.tsx`

### Phase D: Discussion & Collaboration
1. Add Supabase realtime subscription for lesson discussions in `LessonPlayer.tsx`
2. Add group project inline comments in `GroupProjectsPage.tsx`
3. Add peer review auto-assignment logic

### Phase E: Transcript QR & Profile Polish
1. Add QR code to transcript PDF (using qrcode library)
2. Update `ProfileCompletenessWidget` with new fields
3. Add virtual lab completion tracking

### Phase F: Admin Dashboard Super-Widget
1. Add aggregate stat cards for batches, attendance, plagiarism, internships, research, live classes, AI sessions

### Phase G: SMS System (if provider configured)
1. Create `send-sms` edge function skeleton
2. Add admin SMS compose page
3. Add student SMS opt-in toggle

---

## Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Add `review_count`, trigger, `virtual_lab_completions` |
| `src/pages/cart/Checkout.tsx` | Add installment plan selection + currency conversion |
| `src/components/layout/Header.tsx` | Add currency selector |
| `src/pages/dashboard/DashboardOverview.tsx` | Add installment widget |
| `src/pages/courses/CourseDetail.tsx` | Add 50% completion gate for reviews |
| `src/pages/learn/LessonPlayer.tsx` | Add realtime subscription for discussions |
| `src/pages/instructor/InstructorGradebook.tsx` | Add grade-published notification |
| `src/pages/dashboard/TranscriptPage.tsx` | Add QR code generation |
| `src/pages/dashboard/GroupProjectsPage.tsx` | Add inline comments |
| `src/hooks/useProfileCompleteness.ts` | Add new field checks |
| `src/pages/admin/AdminDashboard.tsx` | Add aggregate widgets |
| `supabase/functions/send-sms/index.ts` | New SMS edge function |

This is a large scope (~15 file changes + 1 migration). I recommend implementing in the phases above, starting with Phase A+B (database + checkout) as they have the highest user impact.

