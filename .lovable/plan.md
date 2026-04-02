## Plan: Transform into the Most Advanced Online Textile University LMS

### Current State Summary

The system already has a solid foundation: 3-role architecture (Student/Instructor/Admin), course management, quiz/assignment/grading pipeline, ebook store, wallet/payment system, certificate generation, notifications, media library, discussions, announcements, analytics, and super admin controls. This is a strong LMS but still feels like a **generic course platform**, not a **university**.

### What's Missing to Become a True Online Textile University


| Category      | Missing Feature                               | University Impact                                |
| ------------- | --------------------------------------------- | ------------------------------------------------ |
| Academic      | No wishlist/bookmark system                   | Students can't save courses for later            |
| Academic      | No course reviews from students               | No social proof or feedback loop                 |
| Academic      | No note-taking inside lessons                 | Students can't take notes while learning         |
| Academic      | No course prerequisites system                | No academic progression enforcement              |
| Engagement    | No student leaderboard / gamification         | No motivation system                             |
| Engagement    | No learning streaks / badges                  | No habit-building mechanics                      |
| Engagement    | No course wishlist                            | Students can't plan their learning path          |
| Communication | No real-time chat / messaging                 | No peer-to-peer or student-instructor messaging  |
| Communication | No Q&A per lesson (separate from discussions) | Discussions exist but aren't lesson-specific Q&A |
| Content       | No course bundles / learning paths            | No structured textile degree-like programs       |
| Content       | No FAQ section per course                     | Common questions not addressed                   |
| Analytics     | No student progress report (downloadable)     | Students can't track their academic journey      |
| University    | No departments / faculties page               | Doesn't feel like a university                   |
| University    | No academic calendar / events                 | No semester or event awareness                   |
| University    | No alumni / success stories section           | No social proof beyond testimonials              |
| SEO/Marketing | No course comparison feature                  | Students can't compare courses side-by-side      |


### Implementation Plan (Prioritized by Impact)

**Phase 1: Core University Features (High Impact)**

**1. Course Wishlist System**

- New table: `wishlists` (user_id, course_id, created_at)
- Heart icon on course cards and course detail page
- New dashboard page: `WishlistPage.tsx` showing saved courses
- Add to dashboard sidebar

**2. Course Review & Rating System**

- New table: `reviews` (if not exists, verify first — code references it but schema unclear)
- Star rating + text review on CourseDetail page (only for enrolled students who completed 50%+)
- Instructor can reply to reviews
- Admin can moderate/delete reviews
- Updates `courses.avg_rating` via trigger

**3. Learning Paths / Course Bundles**

- New table: `learning_paths` (id, title, description, thumbnail_url, courses jsonb array with order, price, is_published)
- New public page: `LearningPaths.tsx` — browse structured programs like "Textile Engineering Diploma"
- New detail page: `LearningPathDetail.tsx` — shows courses in order with progress
- Admin management page for creating/editing paths
- Students can enroll in entire path

**4. Student Note-Taking in Lessons**

- New table: `lesson_notes` (user_id, lesson_id, content, timestamp_seconds, created_at, updated_at)
- Add notes panel in LessonPlayer sidebar
- Students can create timestamped notes while watching
- Export notes as text from dashboard

**5. Course Prerequisites**

- New column on `courses`: `prerequisite_course_ids uuid[]`
- CourseDetail shows prerequisites with completion status
- Enrollment blocked if prerequisites not completed
- Visual prerequisite chain on course page

**Phase 2: Engagement & Gamification**

**6. Student Leaderboard**

- New page: `LeaderboardPage.tsx` (public)
- Ranking by: courses completed, quiz scores, certificates earned
- Monthly/all-time filters
- Top 10 displayed on homepage

**7. Learning Streaks & Achievement Badges**

- New table: `user_badges` (user_id, badge_type, earned_at)
- Badge types: first_course_complete, quiz_master, streak_7, streak_30, top_reviewer
- Show badges on student profile
- Streak tracking based on daily lesson completions

**Phase 3: University Identity**

**8. Departments / Faculties Page**

- New static page: `DepartmentsPage.tsx`
- Sections: Textile Engineering, Fashion Design, Yarn Manufacturing, Fabric Analysis, Quality Control, Dyeing & Finishing
- Each department links to filtered course catalog
- Uses existing `categories` table for department mapping

**9. Academic Calendar & Events**

- New table: `events` (id, title, description, event_date, event_type, image_url, is_featured)
- New public page: `EventsPage.tsx` with calendar view
- Event types: webinar, exam_schedule, workshop, deadline
- Admin can manage events

**10. Alumni Success Stories**

- New table: `success_stories` (id, name, photo_url, story, course_id, graduation_year, current_role, is_featured)
- New public page: `AlumniPage.tsx`
- Featured stories on homepage
- Admin CRUD for stories

### Database Changes (New Tables)

```sql
-- Wishlists
CREATE TABLE wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, course_id)
);
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- Lesson Notes
CREATE TABLE lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  content text NOT NULL,
  timestamp_seconds integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE lesson_notes ENABLE ROW LEVEL SECURITY;

-- Learning Paths
CREATE TABLE learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  thumbnail_url text,
  course_ids uuid[] DEFAULT '{}',
  price numeric DEFAULT 0,
  is_published boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;

-- Events / Academic Calendar
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_date timestamptz NOT NULL,
  event_type text DEFAULT 'general',
  image_url text,
  link text,
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Success Stories / Alumni
CREATE TABLE success_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  photo_url text,
  story text NOT NULL,
  course_title text,
  graduation_year integer,
  current_role text,
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE success_stories ENABLE ROW LEVEL SECURITY;

-- User Badges / Gamification
CREATE TABLE user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_type text NOT NULL,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_type)
);
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Course prerequisites column
ALTER TABLE courses ADD COLUMN IF NOT EXISTS prerequisite_course_ids uuid[] DEFAULT '{}';
```

### Files to Create


| File                                       | Purpose                          |
| ------------------------------------------ | -------------------------------- |
| `src/pages/dashboard/WishlistPage.tsx`     | Student's saved courses          |
| `src/pages/courses/LearningPaths.tsx`      | Browse learning paths (programs) |
| `src/pages/courses/LearningPathDetail.tsx` | Single path with course sequence |
| `src/pages/static/DepartmentsPage.tsx`     | University departments overview  |
| `src/pages/static/EventsPage.tsx`          | Academic calendar & events       |
| `src/pages/static/AlumniPage.tsx`          | Success stories                  |
| `src/pages/dashboard/LeaderboardPage.tsx`  | Student rankings                 |
| `src/pages/admin/AdminEvents.tsx`          | Admin event management           |
| `src/pages/admin/AdminSuccessStories.tsx`  | Admin alumni management          |
| `src/pages/admin/AdminLearningPaths.tsx`   | Admin learning path builder      |


### Files to Edit


| File                                         | Changes                                                       |
| -------------------------------------------- | ------------------------------------------------------------- |
| `src/App.tsx`                                | Add ~10 new routes                                            |
| `src/pages/courses/CourseDetail.tsx`         | Add wishlist button, prerequisites display, review submission |
| `src/pages/learn/LessonPlayer.tsx`           | Add notes panel in sidebar                                    |
| `src/components/layout/DashboardSidebar.tsx` | Add Wishlist, Leaderboard links                               |
| `src/components/layout/AdminSidebar.tsx`     | Add Events, Stories, Learning Paths                           |
| `src/components/layout/Header.tsx`           | Add Departments, Events to nav                                |
| `src/pages/Index.tsx`                        | Add alumni stories section, leaderboard preview               |
| `src/components/layout/Footer.tsx`           | Add new page links                                            |


### Implementation Order

Due to scope, this will be implemented in 3 phases across multiple steps:

1. **Phase 1** (this implementation): Wishlist + Notes + Prerequisites + Learning Paths + Reviews — 6 new files, 5 edits, 1 migration
2. **Phase 2** (next): Leaderboard + Badges + Streaks — 2 new files, 3 edits
3. **Phase 3** (next): Departments + Events + Alumni + Admin pages — 5 new files, 4 edits, 1 migration

Total across all phases: ~13 new files, ~12 file edits, 2 migrations.

&nbsp;

you mark this and make this and implement all of this specially live chat and real time chat most advanced 