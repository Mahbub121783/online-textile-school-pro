

## Plan: Student Management System for Admin & Instructor

### Problem
There is no dedicated "Student Management" section. The current `AdminUsers` page shows all users in a flat table with no purchase data, no detail view, and no ability to grant course/ebook access. Instructors have a basic students list but no rich profile view either.

### What We're Building

**A new Student Management page** (`/admin/students`) and a **Student Detail page** (`/admin/students/:id`) accessible from the Admin sidebar. The instructor sidebar will also get a link to `/admin/students` (or we enhance the existing `/instructor/students` with a detail drawer).

### New Files

| File | Purpose |
|------|---------|
| `src/pages/admin/AdminStudents.tsx` | Student list with avatar, name, courses purchased count, ebooks purchased count, total spend. Search + filters. Click row opens detail page. |
| `src/pages/admin/StudentDetail.tsx` | Full student profile: avatar, name, phone, roll ID, join date, activity summary. Tabs for: Purchased Courses, Purchased Ebooks, Wallet/Transactions, Forum Activity, Certificates. Admin can grant free course or ebook access directly from here. |

### Edited Files

| File | Changes |
|------|---------|
| `src/App.tsx` | Add routes: `/admin/students` and `/admin/students/:id` |
| `src/components/layout/AdminSidebar.tsx` | Add "Students" nav item under top items (with `GraduationCap` icon) |
| `src/components/layout/InstructorSidebar.tsx` | Add "All Students" link pointing to `/admin/students` (only visible if user also has admin role, otherwise keep existing instructor students page) |

### AdminStudents.tsx — Student List

- Query `user_roles` for all users with role `student`
- Join with `user_profiles` for avatar, name, phone, roll_id
- Count enrollments per student (courses purchased)
- Count ebook purchases from `orders` table (items with ebook type)
- Display in a responsive card grid (mobile) / table (desktop)
- Each card shows: avatar, name, roll ID, courses count, ebooks count, join date
- Search by name, filter by active/inactive
- Click navigates to `/admin/students/:id`

### StudentDetail.tsx — Full Profile + Admin Actions

**Header section:**
- Large avatar, full name, roll ID, phone, join date, active status badge
- "Grant Course Access" button — opens dialog to select a course and create enrollment
- "Grant Ebook Access" button — opens dialog to select an ebook and create order

**Tabs:**
1. **Courses** — List of enrolled courses with progress %, enrollment date, completion status
2. **Ebooks** — List of purchased ebooks with purchase date
3. **Expenses** — Orders table showing all orders with amounts, dates, payment status
4. **Activity** — Forum posts count, quiz attempts, assignment submissions, certificates earned
5. **Wallet** — Current balance, recent transactions

**Grant Access feature:**
- "Grant Course" — Select from all published courses → insert into `enrollments` with `user_id` and `course_id`
- "Grant Ebook" — Select from all published ebooks → insert into `orders` with item_type `ebook`, price 0, status `completed`

### Sidebar Changes

AdminSidebar gets a new item right after "Users":
```
{ title: 'Students', url: '/admin/students', icon: GraduationCap }
```

### Technical Notes
- No migration needed — all data exists in current tables (`user_roles`, `user_profiles`, `enrollments`, `orders`, `ebooks`, `courses`, `certificates`, `forum_posts`, `quiz_attempts`, `assignment_submissions`, `wallets`, `wallet_transactions`)
- Grant access inserts use existing RLS policies (admin can insert enrollments per existing policy)
- Total: 2 new files, 3 edited files, 0 migrations

