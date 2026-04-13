

# Phase 2: Learning Engagement - Implementation Plan

## Summary
Enhance lesson-level discussions with upvotes/pinning, add admin review approval system for course reviews, and build a peer review system for assignments.

---

## What Already Exists
- **Discussions table**: Already has `lesson_id`, `parent_id`, `is_answered`, `course_id`, `user_id`, `content`. Q&A tab already works in LessonPlayer.
- **Reviews table**: Already has `user_id`, `course_id`, `rating`, `comment`. Review form and display exist in CourseDetail.
- **Assignment submissions table**: Has `assignment_id`, `user_id`, `submission_text`, `file_url`, `score`, `feedback`, `status`.

## What Needs to Be Built

### Database Migration

**1. Enhance `discussions` table:**
- Add `upvote_count` (integer, default 0)
- Add `is_pinned` (boolean, default false)
- Add `is_closed` (boolean, default false)

**2. Create `discussion_upvotes` table:**
- `id`, `discussion_id` (FK), `user_id` (FK), `created_at`
- UNIQUE on (discussion_id, user_id)
- RLS: authenticated can insert/delete own, select all

**3. Enhance `reviews` table:**
- Add `is_approved` (boolean, default null) -- null = pending, true = approved, false = rejected
- Add `admin_response` (text, nullable)

**4. Create `peer_reviews` table:**
- `id`, `submission_id` (FK to assignment_submissions), `reviewer_id` (FK to user_profiles), `course_id` (FK), `rubric_scores` (jsonb), `feedback` (text), `rating` (integer 1-5), `created_at`
- UNIQUE on (submission_id, reviewer_id)
- RLS: reviewer can insert/update own, students can read reviews of their submissions, admin/instructor full access

**5. Create `peer_review_config` table:**
- `id`, `assignment_id` (FK, unique), `min_reviewers` (integer, default 2), `rubric_criteria` (jsonb), `is_enabled` (boolean, default false), `created_at`
- RLS: admin/instructor manage, students read

---

### Frontend Changes

**6. Enhanced Lesson Discussions (LessonPlayer.tsx):**
- Add upvote button with count on each discussion post
- Add "Pin" and "Close Thread" buttons for instructor/admin
- Show pinned discussions at top
- Sort by upvote count or newest
- Real-time subscription for new posts via Supabase realtime

**7. Admin Review Approval Page (`AdminReviews.tsx`):**
- New admin page at `/admin/reviews`
- List all pending reviews with approve/reject buttons
- Admin can write response to reviews
- Add to AdminSidebar under a new "Engagement" collapsible menu
- Only approved reviews show on CourseDetail page

**8. Update CourseDetail.tsx:**
- Filter reviews to only show `is_approved = true`
- Show admin responses under reviews
- Show "Review pending approval" message after submission

**9. Peer Review System:**
- **Admin/Instructor config**: Add peer review toggle in assignment settings (reuse existing AssignmentTab or create inline config)
- **Auto-assignment**: When a student submits, system checks if peer review is enabled and assigns reviewers from other enrolled students who have also submitted
- **Student Peer Review Page** (`/dashboard/peer-reviews`): List assigned peer reviews with rubric scoring form
- **Instructor view**: See peer review scores alongside their own grading

**10. Routing & Navigation:**
- Add `/admin/reviews` route
- Add `/dashboard/peer-reviews` route  
- Add "Engagement" section to AdminSidebar with Reviews, Discussions items
- Add "Peer Reviews" to student DashboardSidebar

---

### Notifications
- Notify instructor when new lesson discussion is posted
- Notify student when their review is approved/rejected
- Notify student when assigned as peer reviewer
- Notify student when peer review received on their submission

---

## Technical Details

### Files to Create:
- `src/pages/admin/AdminReviews.tsx` - Review approval queue
- `src/pages/dashboard/PeerReviewsPage.tsx` - Student peer review dashboard
- Migration SQL for all schema changes

### Files to Edit:
- `src/pages/learn/LessonPlayer.tsx` - Add upvotes, pin, close, realtime
- `src/pages/courses/CourseDetail.tsx` - Filter approved reviews, show admin responses
- `src/components/layout/AdminSidebar.tsx` - Add Engagement menu
- `src/components/layout/DashboardSidebar.tsx` - Add Peer Reviews link
- `src/App.tsx` - Add new routes
- `src/integrations/supabase/types.ts` - Auto-updated after migration
- `src/lib/notifications.ts` - Already has helpers, will be reused

### Implementation Order:
1. Database migration (all tables/columns at once)
2. Enhanced lesson discussions with upvotes/pinning
3. Review approval system (admin page + CourseDetail filter)
4. Peer review system (config + auto-assign + student UI)
5. Notifications integration
6. Route registration and sidebar updates

