

# Deep Audit Report — Round 3

## Previous Fixes Verified
- Wishlist toggle buttons added to CourseCatalog and CourseDetail
- eBook ownership verified in `ebook-secure-access` edge function (line 71-83 checks `order_items` + completed order)
- `useCouponValidation` hook integrated into Checkout
- Review system with enrollment-gated RLS policies created
- RLS linter now shows only 1 warning (leaked password protection — manual fix)
- "Buy Now" buttons added to catalog cards and detail pages

## Remaining Issues

### CRITICAL

**1. Four `(supabase as any)` casts still bypass type safety**
Files: `EventsPage.tsx`, `LearningPaths.tsx`, `LearningPathDetail.tsx`, `TestimonialsSection.tsx`. These tables (`events`, `learning_paths`, `success_stories`) are already in the generated types. The casts should be removed.

**2. `enrollAfterPayment` uses `as any` on upsert options (line 141)**
`{ onConflict: 'user_id,course_id' } as any` — this is needed because the Supabase types don't accept string-based `onConflict`. However, this means if the column names are wrong, there's no compile-time check. Should use `.upsert(..., { onConflict: 'user_id,course_id', ignoreDuplicates: true })` or handle the duplicate error gracefully.

### HIGH

**3. ~839 `as any` casts across 57 files**
While many are legitimate (e.g., casting Supabase response data), a large portion in files like `QuizBuilder.tsx` (7 casts), `CourseBuilder.tsx` (3 casts), `PaymentDashboardTab.tsx` (10+ casts), and `InstructorDiscussions.tsx` are avoidable. These reduce type safety across the app.

**4. Free "Enroll" button doesn't actually enroll — it adds to cart**
In `CourseDetail.tsx` line 494-495, when `originalPrice === 0` the button says "Enroll Free" but only calls `addItem()` to the cart store. The user must still go through the full checkout flow for a free course. Should directly create an enrollment for free courses.

**5. No enrollment invalidation after checkout**
After `enrollAfterPayment` succeeds, the code navigates to `/dashboard` but never calls `queryClient.invalidateQueries` for enrollment-related queries. The dashboard may show stale data until a page refresh.

### MEDIUM

**6. EbookCatalog missing wishlist + "Buy Now" buttons**
CourseCatalog now has wishlist hearts and "Buy Now" quick-purchase, but EbookCatalog has neither. Inconsistent UX between the two catalogs.

**7. No error boundary around checkout payment flow**
If `process-payment` edge function fails partway, the order is created in `pending` status with `order_items` and `invoice` already inserted, but no cleanup or retry mechanism exists. Partial failures leave orphaned records.

**8. Cart page still has 50+ `as any` references on gateway data**
`PaymentDashboardTab.tsx` uses `as any[]` on every query result instead of properly typing the responses.

**9. `hasPendingOrder` query in CourseDetail includes 'completed' status**
Line 105: `.in('orders.status', ['pending', 'completed'])` — this means if a user already purchased and was enrolled, the "Order Pending Verification" message could show instead of the enrolled state. The `isEnrolled` check takes priority in the UI, but the query is logically wrong for its purpose.

### LOW

**10. No loading/error state for review submission**
The `submitReview` mutation has no pending indicator in the UI — the button doesn't show a spinner or disable during submission.

**11. EbookCatalog shares course categories**
The category filter queries `categories` table which is shared between courses and ebooks. If categories are meant to be separate, this could show irrelevant filters.

---

## Implementation Plan

### Phase 1: Critical Type Safety
1. Remove all 4 remaining `(supabase as any)` casts in `EventsPage.tsx`, `LearningPaths.tsx`, `LearningPathDetail.tsx`, `TestimonialsSection.tsx`
2. Fix the `as any` on upsert in `enrollAfterPayment`

### Phase 2: Functional Fixes
3. Add direct free enrollment in `CourseDetail.tsx` — when price is 0, skip cart and call enrollment insert directly
4. Add `queryClient.invalidateQueries` for enrollments after checkout success
5. Fix `hasPendingOrder` query to only check `'pending'` status, not `'completed'`

### Phase 3: UX Parity
6. Add wishlist toggle and "Buy Now" to `EbookCatalog.tsx` cards
7. Add loading spinner to review submission button
8. Progressively remove unnecessary `as any` casts in high-traffic files (`PaymentDashboardTab`, `QuizBuilder`, `CourseBuilder`)

### Technical Details
- Free enrollment: Create a `useFreeEnroll` mutation that inserts into `enrollments` directly, creates a zero-amount order + order_items for audit trail, then invalidates queries
- Query invalidation: After `enrollAfterPayment`, call `queryClient.invalidateQueries({ queryKey: ['enrollments'] })` and `queryClient.invalidateQueries({ queryKey: ['enrollment'] })`
- `hasPendingOrder` fix: Change `.in('orders.status', ['pending', 'completed'])` to `.eq('orders.status', 'pending')`

