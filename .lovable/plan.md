

# Advanced Coupon System: Per-User Limits & Product-Specific Coupons

## What We Will Build

### 1. Database Changes (Migration)

**New table: `coupon_usage`** -- tracks per-user coupon usage
- `id` (uuid), `coupon_id` (uuid, FK to coupons), `user_id` (uuid, FK to auth.users), `order_id` (uuid, nullable), `used_at` (timestamptz, default now())
- Unique constraint on `(coupon_id, user_id, order_id)` to prevent double-counting

**Extend `coupons` table:**
- `per_user_limit` (integer, nullable) -- max times a single user can use this coupon (null = unlimited)
- `applicable_type` (text, default 'all') -- 'all', 'course', 'ebook', 'research_paper'
- `applicable_ids` (uuid[], nullable) -- specific course/ebook IDs this coupon applies to (null = all items of that type)

### 2. Admin Coupon Form Enhancement (`AdminCoupons.tsx`)

Add to the create/edit dialog:
- **Per-User Usage Limit** field (number input, placeholder "Unlimited") -- how many times one user can redeem
- **Applies To** selector: All / Courses Only / Ebooks Only / Research Papers / Specific Items
- When "Specific Items" chosen for a type, show a **multi-select picker** that loads courses/ebooks from the database so admin can pick which items the coupon is valid for
- Display per-user limit and scope in the table columns

### 3. Validation Hook Enhancement (`useCouponValidation.ts`)

Update `applyCoupon` to:
- Accept `userId` and `cartItems` (with type info) as parameters
- Query `coupon_usage` to check how many times the current user has used this coupon
- Compare against `per_user_limit` -- reject if exceeded
- Check `applicable_type` and `applicable_ids` against cart items -- reject if no matching items in cart
- `calculateDiscount` updated to only apply discount to eligible items (not the full subtotal)

### 4. Checkout Integration (`Checkout.tsx`)

- Pass user ID and cart items to the coupon validation
- After successful order, insert a row into `coupon_usage` to record usage
- Show which items the coupon applies to if it is product-specific

## Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Add `coupon_usage` table, extend `coupons` with `per_user_limit`, `applicable_type`, `applicable_ids` |
| `src/pages/admin/AdminCoupons.tsx` | Add per-user limit field, product scope selector with item picker |
| `src/hooks/useCouponValidation.ts` | Add per-user check via `coupon_usage`, product-type filtering |
| `src/pages/cart/Checkout.tsx` | Record usage in `coupon_usage` after order, pass cart context to validation |
| `src/integrations/supabase/types.ts` | Update with new table/columns |

