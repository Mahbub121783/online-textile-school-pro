

## Plan: Bulk Assign Courses & Ebooks + Show Assigned Content

### What's Missing

1. **No bulk assign** — Admin can only grant course/ebook to one student at a time from the StudentDetail page. No way to select multiple students from the list and assign a course or ebook to all of them at once.
2. **Assigned content not visible** — After granting access, there's no indication on the student list which courses/ebooks were assigned (admin-granted vs purchased).

### Changes

#### File 1: `src/pages/admin/AdminStudents.tsx`

**Add to bulk actions bar** (alongside existing Block/Activate buttons):
- **"Assign Course"** button — opens a dialog with a course dropdown. On confirm, creates an enrollment for each selected student (skips if already enrolled).
- **"Assign Ebook"** button — opens a dialog with an ebook dropdown. On confirm, creates an order + order_item for each selected student (skips if already has access).

**New queries needed:**
- Fetch all published courses (`courses` where `is_published = true`) for the assign dialog
- Fetch all published ebooks (`ebooks` where `is_published = true`) for the assign dialog

**New mutations:**
- `bulkAssignCourse`: loops through selected student IDs, inserts enrollment for each. Uses `upsert` or checks existing to skip duplicates.
- `bulkAssignEbook`: loops through selected student IDs, creates order + order_item for each.

**New UI elements:**
- Two `Dialog` components in the bulk actions bar with `Select` dropdowns for choosing course/ebook
- Success toast showing count of assignments made

#### File 2: `src/pages/admin/StudentDetail.tsx`

**Courses tab enhancement:**
- Add a small badge "Admin Granted" on enrollments where `payment_id` is null (indicating free/admin grant vs paid enrollment)

**Ebooks tab enhancement:**
- Add "Admin Granted" badge on orders where `payment_method = 'admin_grant'`

### File Summary

| File | Change |
|------|--------|
| `src/pages/admin/AdminStudents.tsx` | Add bulk assign course/ebook dialogs in bulk actions bar, new mutations |
| `src/pages/admin/StudentDetail.tsx` | Add "Admin Granted" badges on assigned content |

No migration needed — uses existing tables and RLS policies (admin can insert enrollments and orders).

