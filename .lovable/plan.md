

# Admin Students Section — Bug Fixes & Improvements

## Critical Bug Found

### RLS Policy on `orders` table blocks admin ebook grants
The screenshot shows: *"new row violates row-level security policy for table orders"*

**Root cause**: The `orders` INSERT policy is `auth.uid() = user_id`. When an admin grants an ebook to a student, it inserts an order with `user_id = student_id`, but the logged-in user is the admin — so RLS rejects it.

The `order_items` and `enrollments` tables already have admin INSERT policies. Only `orders` is missing one.

## Other Issues Found

### 1. Ebook revoke doesn't work
In `StudentDetail.tsx` line 293-306, the `revokeAccess` mutation only handles `type === 'enrollment'` deletion. There is no code to revoke ebook access (delete the order/order_items). The UI doesn't even offer a Revoke button for ebooks.

### 2. Supabase 1000-row limit risk
`AdminStudents.tsx` fetches ALL students via multiple queries without `.limit()`. If there are 1000+ students, data will be silently truncated. The `user_roles`, `enrollments`, `orders`, `order_items`, `certificates`, `quiz_attempts` queries all hit this limit.

### 3. Notification INSERT policy blocks student-targeted notifications
The notification INSERT policy requires `auth.uid() = user_id` OR admin role. Admin role works, but the `sendNotification` mutation in StudentDetail correctly sets the student's `user_id` — this should work since admins have INSERT permission. Confirmed OK.

## Fix Plan

### Step 1: Database Migration — Add admin INSERT policy on `orders`
```sql
CREATE POLICY "Admins can insert orders"
ON orders FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);
```

### Step 2: Fix ebook revoke in `StudentDetail.tsx`
- Add handling for `type === 'ebook-order'` in the `revokeAccess` mutation to delete the order_items and order
- Add a Revoke button to each ebook row in the Ebooks tab

### Step 3: Handle large student counts
- Add pagination at the Supabase query level using `.range()` instead of fetching all students client-side
- OR add `.limit(5000)` to prevent silent truncation for now (simpler fix)

## Files Modified
1. **Database migration** — Add admin INSERT policy on `orders`
2. **`src/pages/admin/StudentDetail.tsx`** — Fix ebook revoke, add revoke button to ebook rows
3. **`src/pages/admin/AdminStudents.tsx`** — Add query limits to prevent silent data truncation

