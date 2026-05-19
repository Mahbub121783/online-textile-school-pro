## Remaining issues found (deep audit)

### 1. `Checkout.tsx` — coupon auto-apply runs during render (CRITICAL)
Lines 82–84 call `autoApplyCouponFromUrl()` directly in the component body, not inside `useEffect`. This fires on every render until the `couponAutoApplied` flag flips and can race / duplicate-trigger the coupon API. Move to a proper `useEffect` keyed on `[user?.id, urlCoupon]`.

### 2. `Checkout.tsx` — billing form fields stay blank if profile loads late
`formData` uses lazy state init from `profile`. If `useAuth` hydrates `profile` after mount (the common path — cache miss), name/phone/district stay empty and the user has to retype. Add a `useEffect` that syncs name/phone/district from `profile` only while the field is still empty (don't overwrite user typing).

### 3. `Checkout.tsx` — wallet & free-order paths abort whole flow if invoice update fails
After `orders.update({status: completed})` we do `invoices.update(...)` un-guarded. If the invoice insert was skipped (step 2 already wraps it in try/catch), the update finds no row and the unhandled error throws out of the whole handler, leaving the order completed but enrollment never created. Wrap both `invoices.update` calls in try/catch, and only treat `orders.update` + `enrollAfterPayment` as critical.

### 4. `EbookDetail.tsx` — bare "Loading..." text feels stuck on slow networks
Replace with the same `Skeleton` pattern used in `CourseDetail` so the page communicates progress instead of looking frozen.

### 5. `useLessonProgress` — duplicate export with conflicting signatures
`src/hooks/useLessonProgress.ts` exports `useLessonProgress()` (no args, returns Map) and `src/hooks/useEnrollments.ts` exports `useLessonProgress(courseId)` (returns array). They share a similar `queryKey` prefix which can cause cross-cache invalidation surprises. Rename the map-based one to `useLessonProgressMap` and update its single caller, so the two never collide.

### 6. `useWishlist` — wishlist query has no `retry: 0` / fail-soft
A transient DB error throws inside `queryFn` (no try/catch). Add the same defensive pattern as other hooks: `retry: 0`, try/catch, return empty Set on failure.

### Out of scope (intentional, leave as-is)
- `refetchOnMount: false` on home-page sections — intentional free-tier load reduction.
- ErrorBoundary auto-reload on chunk errors — already correct.

## Verification
- Hard refresh, open `/checkout` with `?coupon=X` and confirm the coupon applies exactly once (network panel).
- Log in fresh, open `/checkout` — billing fields should pre-fill from profile.
- Simulate offline mid-checkout for wallet payment — order completes and enrollment is created.
- Open `/ebooks/<slug>` on throttled network — skeleton shows instead of "Loading...".
- Grep confirms only one `useLessonProgress` import per file after rename.

## Files to edit
- `src/pages/cart/Checkout.tsx`
- `src/pages/ebooks/EbookDetail.tsx`
- `src/hooks/useLessonProgress.ts` (rename export)
- `src/hooks/useWishlist.ts`
- Any caller of the old `useLessonProgress()` (map variant) — likely `LessonPlayer.tsx` / curriculum components; will grep and update.
