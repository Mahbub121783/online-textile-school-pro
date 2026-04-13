

# Deep Audit Report — Round 2

## Previous Fixes Verified
The following issues from the first audit are now resolved:
- Missing tables (`wishlists`, `learning_paths`, `learning_path_courses`, `events`) — all created
- StatsSection — now queries real DB counts
- TestimonialsSection — now queries `success_stories` with fallback
- CourseCatalog — dynamic categories, sorting, and pagination all working
- InstructorSpotlight — batch queries implemented (no more N+1)
- Auth race condition — `setLoading(false)` now waits for profile/roles
- `refetchOnMount: 'always'` — applied globally
- BD_DISTRICTS — updated (need to verify count)
- `useCouponValidation` hook — created but NOT used anywhere

---

## CRITICAL Issues

### 1. No "Add to Wishlist" button anywhere
The `wishlists` table and `WishlistPage` exist, but there is no UI to add a course to the wishlist. `CourseDetail.tsx` and `CourseCatalog.tsx` have no Heart/wishlist button. The feature is completely broken end-to-end.

### 2. eBook ownership not checked in EbookReader
The EbookReader grants access to any logged-in user — it calls `ebook-secure-access` edge function with just the ebook ID and user token, but there's no client-side or server-side check that the user actually purchased the eBook. The checkout comment says "eBook ownership is tracked via completed order_items" but this is never verified before granting read access.

### 3. Checkout still doesn't create enrollments for free eBooks
In the free order path (line 360-374), only courses get enrollment records. eBooks get no ownership record beyond `order_items`, and the `order_items` insert happens before the order status is set to "completed" — so checking for `order_items` with a completed order may fail depending on timing.

---

## HIGH Priority

### 4. Shared `useCouponValidation` hook created but never used
Both `CartPage.tsx` and `Checkout.tsx` still have their own duplicate inline coupon logic. The hook was created but never integrated, defeating its purpose.

### 5. 79 unnecessary `(supabase as any)` casts
The types file already includes `events`, `learning_paths`, `wishlists`, `success_stories`, `invoices`, `order_items`, `payment_gateways`, and `coupons`. All `(supabase as any)` casts across 8 files can be removed for proper type safety.

### 6. 67 `as any` casts in Checkout.tsx
Similarly, most `as any` casts on `.from('coupons' as any)`, `.from('invoices' as any)`, etc. are no longer needed since the types were regenerated.

---

## MEDIUM Priority

### 7. Two overly permissive RLS policies remain
The Supabase linter still flags 2 `USING (true)` policies on non-SELECT operations. These need to be identified and tightened.

### 8. Leaked password protection still disabled
This is a Supabase Auth dashboard setting — cannot be fixed via code. Must be enabled manually.

### 9. No "Buy Now" on CourseCatalog cards
`CourseDetail.tsx` and `EbookDetail.tsx` have Buy Now buttons, but the catalog listing cards only have "Add to Cart." A direct purchase path from catalog cards would improve conversion.

### 10. Cart doesn't show item thumbnails
The cart store's `addItem` in CourseCatalog doesn't pass `thumbnail_url`, making cart items display without images. Some call sites pass it, others don't — inconsistent.

---

## LOW Priority

### 11. No ebook category filter on EbookCatalog
CourseCatalog has dynamic category filters from DB, but EbookCatalog likely doesn't have equivalent filtering.

### 12. CourseDetail missing wishlist + share buttons
No social sharing or wishlist toggle on the course detail page.

### 13. Review/rating system UI missing on CourseDetail
The `reviews` table exists, `avg_rating` is displayed, but there's no UI for students to submit reviews after completing a course.

---

## Implementation Plan

### Phase 1: Critical Fixes
1. **Add wishlist toggle button** to `CourseDetail.tsx` and `CourseCatalog.tsx` cards — insert/delete from `wishlists` table with optimistic UI
2. **Verify eBook access control** in the `ebook-secure-access` edge function — ensure it checks ownership via `order_items` with completed orders, or free eBooks
3. **Fix free-order eBook tracking** — ensure eBook purchases in the free-order and wallet paths create proper ownership records

### Phase 2: Code Quality
4. **Integrate `useCouponValidation` hook** into both `CartPage.tsx` and `Checkout.tsx`, removing duplicate logic
5. **Remove all unnecessary `as any` casts** across 8+ files (LearningPaths, Events, Wishlist, AdminEvents, AdminLearningPaths, AdminSuccessStories, Checkout, TestimonialsSection)
6. **Identify and fix the 2 overly permissive RLS policies**

### Phase 3: UX Enhancements
7. **Add review/rating submission UI** on CourseDetail for enrolled students
8. **Pass `thumbnail_url` consistently** to cart store from all add-to-cart call sites
9. **Add "Buy Now" to catalog cards** for direct checkout

### Technical Details
- Wishlist toggle: Use `useMutation` with `onMutate` for optimistic updates; query `wishlists` table filtered by `user_id` and `course_id`
- eBook access: The edge function `ebook-secure-access` needs a query like `SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.item_id = ebook_id AND oi.item_type = 'ebook' AND o.user_id = user_id AND o.status = 'completed'`
- RLS fix: Run a query to identify which tables have the permissive policies, then create a migration to replace them with proper conditions

