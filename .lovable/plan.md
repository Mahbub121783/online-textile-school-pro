

## Plan: Advanced Student Management System with Block/Remove, Global Search & Enhanced Interactivity

### What's Missing Now

| Gap | Details |
|-----|---------|
| **No Block/Suspend/Remove** | Admin cannot deactivate, block, or remove a student |
| **No global search** | Search only checks name, roll ID, phone — no email, university, batch, district |
| **No bulk actions** | Cannot select multiple students for bulk operations |
| **No CSV export** | No way to export student data |
| **No last active / login tracking** | No visibility into when student was last active |
| **No email column** | Student email not shown anywhere (need to query auth or add to profile display) |
| **No admin notes** | Admin cannot leave notes on a student profile |
| **No enrollment revoke** | Admin can grant course but cannot remove enrollment |
| **Duplicate fields** in StudentDetail (Graduation Year shown twice, Country shown twice) |
| **No confirmation dialogs** for destructive actions |

### Changes

#### File 1: `src/pages/admin/AdminStudents.tsx` (Major Rewrite)

**New features:**
- **Global search**: Search across name, roll_id, phone, university, batch, district, division, occupation, company_name — every text field in user_profiles
- **Bulk select**: Checkbox column to select multiple students
- **Bulk actions toolbar**: Appears when students selected — options: Block Selected, Activate Selected, Export Selected
- **CSV Export button**: Export filtered students list as CSV (name, roll ID, phone, courses, ebooks, spend, status, joined date)
- **More stats cards**: Add Blocked count, New This Month count (4 cards instead of 3)
- **Row actions dropdown**: On each row, a `...` menu with View Profile, Block/Unblock, Deactivate options (without navigating away)
- **Block/Unblock**: Sets `is_active = false` on user_profiles + shows confirmation dialog
- **Pagination**: Show 25 per page with page controls (currently shows all which won't scale)
- **Visual improvements**: Skeleton loading states, animated stat cards, row highlight on hover with border accent

#### File 2: `src/pages/admin/StudentDetail.tsx` (Enhanced)

**New features:**
- **Admin action bar** at top: Block Student, Deactivate Student, Remove All Enrollments — each with confirmation AlertDialog
- **Revoke enrollment**: Each course row gets a "Revoke" button that deletes enrollment with confirmation
- **Revoke ebook access**: Each ebook row gets a "Revoke" button
- **Admin Notes section**: A textarea where admin can add/edit notes about the student (stored in `user_profiles.admin_notes` — new column needed but since we can't add it without migration, we'll use a local `admin_activity_log` entry with target_type='student_note')
- **Fix duplicate fields**: Remove duplicate Graduation Year and Country fields
- **Last login indicator**: Show `updated_at` from profile as approximate last activity
- **Status toggle**: A Switch component to toggle `is_active` directly from the profile header
- **Send notification**: Button to send a direct notification to the student

### Implementation Details

**Block/Deactivate flow:**
- Uses `supabase.from('user_profiles').update({ is_active: false })` 
- Shows AlertDialog confirmation before action
- Invalidates query cache after mutation
- Logs action to `admin_activity_log`

**Revoke enrollment:**
- Currently RLS blocks DELETE on enrollments. Instead of migration, we'll update enrollment's `completed_at` to mark it, or we add a migration to allow admin DELETE on enrollments.
- **Migration needed**: Add DELETE policy on `enrollments` for admins

**CSV Export:**
- Browser-native: build CSV string from filtered data, create Blob, trigger download via anchor click

**Global search implementation:**
- Existing search checks 3 fields. Expand to check: `full_name`, `roll_id`, `phone`, `university`, `batch`, `district`, `division`, `occupation`, `company_name`, `username`

**Pagination:**
- Client-side pagination with `page` and `perPage` state, slice filtered array

### Migration

```sql
-- Allow admins to delete enrollments (for revoking access)
CREATE POLICY "Admins can delete enrollments"
ON public.enrollments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
```

### File Summary

| File | Action |
|------|--------|
| `src/pages/admin/AdminStudents.tsx` | Major rewrite — global search, bulk actions, CSV export, pagination, row actions, block/unblock |
| `src/pages/admin/StudentDetail.tsx` | Enhanced — admin action bar, revoke enrollment/ebook, status toggle, fix duplicates, send notification |
| Migration | Add DELETE policy on enrollments for admins |

Total: 2 file rewrites, 1 migration.

