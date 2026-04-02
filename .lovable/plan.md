

## Plan: Bulk Assign Courses & Ebooks + Show Assigned Content

### What's Missing

1. **No bulk assign** — Admin can select multiple students but can only block/activate them, not assign courses or ebooks in bulk
2. **No visibility of assigned content** — The student list doesn't show which specific courses/ebooks each student has; only counts are shown

### Changes

#### File 1: `src/pages/admin/AdminStudents.tsx` (Enhanced)

**Add to bulk actions toolbar:**
- "Assign Course" button — opens a dialog to select a course, then creates enrollments for all selected students (skipping already enrolled)
- "Assign Ebook" button — opens a dialog to select an ebook, then creates orders with `status: 'completed'` and `total: 0` for all selected students (skipping those who already have it)

**New state & queries:**
- `bulkAssignCourseOpen` / `bulkAssignEbookOpen` dialog states
- `selectedBulkCourse` / `selectedBulkEbook` selection states
- Query all published courses and ebooks for the selection dropdowns
- Two new mutations: `bulkAssignCourse` and `bulkAssignEbook`

**Bulk assign course flow:**
- For each selected student ID, insert into `enrollments` (user_id, course_id) — skip if enrollment already exists via `.upsert` with `onConflict: 'user_id,course_id'` or check first
- Log to `admin_activity_log` with action `bulk_assign_course`
- Show toast with count of successful assignments

**Bulk assign ebook flow:**
- For each selected student, create an order with `item_type: 'ebook'`, `status: 'completed'`, `total: 0`
- Log to `admin_activity_log` with action `bulk_assign_ebook`
- Show toast with count

**Show assigned content on hover/expand (optional enhancement):**
- In the desktop table row actions dropdown, add "View Courses" and "View Ebooks" items that navigate to the student detail page (already exists)

#### File 2: `src/pages/admin/StudentDetail.tsx` (Minor enhancement)

**Show assigned courses and ebooks clearly:**
- In the Courses tab, add a badge showing "Granted" vs "Purchased" — if the enrollment has no `payment_id`, it was admin-granted
- In the Ebooks tab, add a badge showing "Granted" vs "Purchased" — if the order total is 0, it was admin-granted

### Implementation Details

- Enrollments table has a unique constraint on `(user_id, course_id)` — use upsert or pre-check to avoid duplicates
- For ebook orders, check existing orders with matching `item_id` before inserting
- Both dialogs show a searchable select of available courses/ebooks
- After bulk assign, invalidate `admin-students` query to refresh counts

### File Summary

| File | Action |
|------|--------|
| `src/pages/admin/AdminStudents.tsx` | Add bulk assign course/ebook buttons, dialogs, mutations |
| `src/pages/admin/StudentDetail.tsx` | Add "Granted"/"Purchased" badges on courses and ebooks tabs |

No migration needed — existing tables support this.

