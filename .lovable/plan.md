

## Plan: ID Card Download Gate, Admin ID Card Management & Signature Management

### Features

1. **Profile-complete gate on download** — Students cannot download their ID card (PDF/PNG) unless profile is 100% complete. Show warning with missing fields list.

2. **Admin ID Card Management page** — Super admins can:
   - View all student ID cards in a searchable table
   - Directly grant ID card access to any student (even without paid courses)
   - Block/unblock ID card downloads per student
   - Revoke ID cards

3. **Enhanced Signature Management** — In the existing ID Card Settings page, improve the signature section: upload signature image + name below it, with a live preview showing how it will appear on the card.

### Database Migration

Add a `download_blocked` column to `student_id_cards`:

```sql
ALTER TABLE public.student_id_cards
  ADD COLUMN download_blocked boolean NOT NULL DEFAULT false;
```

No other schema changes needed — admin can already INSERT/UPDATE via the existing "Admins manage id cards" policy.

### File Changes

**1. `src/components/student/StudentIdCard.tsx`**
- Import `useProfileCompleteness` hook
- Before showing download buttons, check `isComplete` from the hook and `idCard.download_blocked`
- If profile incomplete: disable download button, show alert with list of missing fields and link to profile page
- If download blocked by admin: show "Download blocked by administrator" message, disable button

**2. `src/pages/admin/AdminIdCardManagement.tsx` (new file)**
- Searchable table of all students with columns: Name, Roll ID, Card Number, Status, Download Blocked, Valid Until, Actions
- Query `student_id_cards` joined with `user_profiles`
- Actions per row:
  - Toggle "Block Download" (updates `download_blocked`)
  - Deactivate/Activate card (updates `is_active`)
- "Grant ID Card" button opens a student search modal — admin picks a student without a card, sets validity period, and inserts a new `student_id_cards` row
- All actions logged to `admin_activity_log`

**3. `src/pages/admin/AdminIdCardSettings.tsx` (modify)**
- Enhance the Authority/Signature card:
  - Keep upload functionality
  - Add a canvas-based live preview showing how the signature + name + position renders on the ID card
  - After upload, show the formatted preview immediately
  - Authority name and position inputs already exist — just add the live preview below

**4. `src/components/layout/AdminSidebar.tsx`**
- Add "ID Card Management" link under the Setup submenu (or as a new top-level item near Students)

**5. `src/App.tsx`**
- Add route for `/admin/id-card-management` pointing to the new page

### Layout: Admin ID Card Management Page

```text
+------------------------------------------+
| ID Card Management                       |
| [Grant ID Card]  [Search: ________]      |
+------------------------------------------+
| Name | Roll | Card# | Status | Blocked | |
|------|------|-------|--------|---------|--|
| Ali  | OTS- | OTS-ID| Active | No  [x]| ⋮|
| Rima | OTS- | OTS-ID| Expired| Yes [x]| ⋮|
+------------------------------------------+
```

### File Summary

| File | Action |
|------|--------|
| Migration | Add `download_blocked` column to `student_id_cards` |
| `src/components/student/StudentIdCard.tsx` | Add profile-complete + download-blocked gates |
| `src/pages/admin/AdminIdCardManagement.tsx` | New admin page for managing all ID cards |
| `src/pages/admin/AdminIdCardSettings.tsx` | Add signature live preview |
| `src/components/layout/AdminSidebar.tsx` | Add sidebar link |
| `src/App.tsx` | Add route |

6 file changes, 1 migration.

