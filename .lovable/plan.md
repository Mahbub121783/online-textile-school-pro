

## Plan: Advanced Student Management System with Full Dynamic Profile

### Problems Found

1. **Ebooks tab shows raw UUID** instead of ebook title (line 266 of StudentDetail.tsx)
2. **No full profile section** — missing fields like university, batch, blood group, district, division, occupation, company, DOB, username, referral code, language preference, active status
3. **No quiz/assignment stats** in activity tab
4. **No wallet transaction history** — just shows balance
5. **No reading progress data** for ebooks
6. **Student list page is basic** — no status filter, no sort options, no export
7. **Profile data is not real-time** — no realtime subscription for `user_profiles` changes

### Changes

#### File 1: `src/pages/admin/StudentDetail.tsx` (Full Rewrite)

**Fix ebook names:**
- Change orders query to also fetch ebook titles: query `ebooks` table with the item_ids from order_items and build a name map

**Add full profile section** as the first tab or a dedicated "Profile" tab showing all user_profiles fields in a clean grid layout:
- Full Name, Username, Phone, Roll ID, DOB, Blood Group
- University, Batch, Graduation Year, Occupation
- Company Name, Business Type, Professional Role, Current Job
- District, Division, Country
- Referral Code, Language Preference, Active Status
- All fields auto-update via react-query with realtime invalidation

**Add quiz attempts + assignment submissions to Activity tab:**
- Query `quiz_attempts` count for this user
- Query `assignment_submissions` count for this user

**Add wallet transaction history:**
- Query `wallet_transactions` via wallet_id and show a table with date, type, amount, description

**Add ebook reading progress:**
- Query `ebook_reading_progress` for this user and show progress alongside each ebook

**Add more summary stat cards:**
- Quiz attempts, Assignment submissions, Forum contributor points

#### File 2: `src/pages/admin/AdminStudents.tsx` (Enhanced)

**Add features:**
- Status filter (Active/Inactive) using `is_active` from profile
- Sort toggle (by name, join date, total spend)
- Quiz count and Certificate count columns in desktop table
- Better search: also search by phone number
- Total stats bar at top: total students, active, total revenue from students

#### File 3: `src/hooks/useRealtime.ts` (Edit)

- Add `user_profiles` changes to admin-realtime channel to invalidate `student-profile` and `admin-students` queries — ensures when student updates their profile, admin sees it instantly

### File Summary

| File | Action |
|------|--------|
| `src/pages/admin/StudentDetail.tsx` | Major rewrite — profile tab, ebook names, quiz/assignment stats, wallet txns, reading progress |
| `src/pages/admin/AdminStudents.tsx` | Enhanced — filters, sort, phone search, stats bar, certificate/quiz counts |
| `src/hooks/useRealtime.ts` | Add `admin-students` and `student-profile` invalidation on `user_profiles` changes |

### No migration needed
All data exists in current tables.

