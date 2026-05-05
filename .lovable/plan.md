# Course Builder: Instructor Picker + Admin/Instructor Routing Fix

## Problems to fix

1. **No instructor picker in Course Settings** — currently `instructor_id` is hard-coded to the logged-in user. Admins/super_admins cannot assign a course to a specific instructor (Workshops already have this — Courses don't).
2. **Admin gets redirected to instructor portal after create** — `CourseBuilder` saves and then runs `navigate('/instructor/courses/${id}')` regardless of where the admin started. Admins who entered via `/admin/cms/courses/new` are kicked into the instructor app.
3. **Settings UI exposes instructor-centric copy to admins** — labels like "Instructor's share of course revenue" should adapt for admin context.
4. **Redundant "Instructor Portal" exposure for admins** — admin/super_admin already have full power via Admin Panel; the Instructor Portal link in the user dropdown adds noise (currently `isInstructor = roles ∪ admin ∪ super_admin`, so admins see both).

---

## Changes

### A. `src/pages/instructor/CourseBuilder.tsx`
- Detect scope from `useLocation().pathname`: `isAdminScope = pathname.startsWith('/admin')`.
- Add `instructor_id` to form state (default = current user).
- Load instructors list when `isAdminScope` (same query pattern as `AdminWorkshops`: users with role `instructor`/`admin`/`super_admin` joined with `user_profiles`).
- In **Settings** step, add a new card **"Instructor"** (visible only when `isAdminScope`) with a searchable Select listing instructor name + avatar. Disabled for non-admin instructors (their own id is locked).
- On save, use `form.instructor_id || course?.instructor_id || user.id`.
- After insert, redirect respecting scope:
  - admin → `/admin/cms/courses/${data.id}`
  - instructor → `/instructor/courses/${data.id}`

### B. `src/components/layout/Header.tsx`
- Change `isInstructor` to `roles.includes('instructor')` only (admins no longer see the "Instructor Portal" item in the avatar dropdown — they have Admin Panel). Same change in the mobile menu (line 367).
- Rationale: admins/super_admins manage all courses from the admin panel; the instructor portal is for instructor-role users only. If admin really wants to test the instructor view, they can be granted the instructor role explicitly.

### C. Settings copy
- In the Revenue card, when `isAdminScope`, label reads "Instructor revenue share (%)" with help "Percentage of revenue paid to the assigned instructor."

---

## Out of scope
- Workshop builder already has instructor picker — no change needed.
- We do **not** strip the instructor role from existing admins; this is purely a UI-visibility change in the header.
- No DB migration: `courses.instructor_id` already exists and accepts any user id.

## Files touched
- `src/pages/instructor/CourseBuilder.tsx` (instructor picker, scope-aware redirect, copy)
- `src/components/layout/Header.tsx` (drop admin from `isInstructor` check)

Approve korle implement kore debo.