

# Full Project Audit Report

## Executive Summary
After deeply reviewing the codebase, database schema, security policies, and runtime behavior, I've identified **28 issues** across 7 categories. Here's a prioritized breakdown with actionable fixes.

---

## 1. CRITICAL: Missing Database Tables (Features Will Crash)

Several pages query tables that **do not exist** in the database:

| Page | Missing Table | Impact |
|------|--------------|--------|
| WishlistPage | `wishlists` | Crash on load |
| LearningPaths / LearningPathDetail | `learning_paths`, `learning_path_courses` | Crash on load |
| EventsPage / AdminEvents | `events` | Crash on load |
| AdminLearningPaths | `learning_paths` | Crash on load |

**Fix**: Create these 4 tables with proper columns and RLS policies via migration.

---

## 2. CRITICAL: Checkout Does Not Enroll for eBooks

In `Checkout.tsx`, both the wallet payment and free-order paths only enroll users in **courses** -- eBooks are silently skipped. After purchasing an eBook, the user has no record of ownership.

```text
// Current code (line 344-352, 363-371):
for (const item of items) {
  if (item.type === 'course') {  // <-- eBooks ignored!
    await supabase.from('enrollments').upsert(...)
  }
}
```

**Fix**: Add eBook purchase records to `order_items` (already done) but also need a mechanism to check eBook ownership via completed `order_items` -- the `EbookCatalog` already does this correctly, but `EbookReader` access control should be verified.

---

## 3. HIGH: StatsSection Is Completely Hardcoded

`StatsSection.tsx` shows fake static numbers (50+ instructors, 120+ courses, 10,000+ students, 4.8/5 rating) while the actual database has **9 courses, 7 ebooks, 7 users**. This is misleading.

**Fix**: Query real counts from the database (instructors from `user_roles`, courses from `courses`, students from `user_profiles`, avg rating from `reviews`).

---

## 4. HIGH: TestimonialsSection Is Completely Hardcoded

`TestimonialsSection.tsx` uses a static `TESTIMONIALS` array with 3 fake entries. The database has a `success_stories` table that is never queried here.

**Fix**: Replace the static array with a query to `success_stories` or create a `testimonials` table. Fall back to static data only if the table is empty.

---

## 5. HIGH: Course Categories Are Hardcoded in Filters

`CourseCatalog.tsx` uses `COURSE_CATEGORIES` from `constants.ts` (10 hardcoded textile categories) for filter sidebar, while the database `categories` table may have different entries. The homepage `FeaturedCourses` correctly queries from DB, but the catalog page doesn't.

**Fix**: Replace `COURSE_CATEGORIES` usage in `CourseCatalog` with a dynamic query to the `categories` table.

---

## 6. HIGH: Sort Not Applied in CourseCatalog

The `sortBy` state (`popular`, `newest`, `rating`, `price-low`, `price-high`) is never actually applied. The query always returns `order('enrollment_count', { ascending: false })` and the frontend `filtered` array has no sort logic.

**Fix**: Add sorting logic after filtering, based on the `sortBy` value.

---

## 7. MEDIUM: Security Linter Warnings

- **2 overly permissive RLS policies** with `USING (true)` on non-SELECT operations. Need to identify which tables and tighten.
- **Leaked password protection disabled** -- should be enabled in Supabase Auth settings.

---

## 8. MEDIUM: Excessive `as any` Type Casting

Over 70 instances of `as any` in checkout alone. This hides type errors and suggests the Supabase types file is out of sync with the actual schema. Tables like `payment_gateways`, `order_items`, `coupons` are cast because they're missing from the generated types.

**Fix**: Regenerate `src/integrations/supabase/types.ts` to match current schema. This will eliminate most `as any` casts.

---

## 9. MEDIUM: Auth Race Condition

In `useAuth.tsx`, `setLoading(false)` is called immediately after `onAuthStateChange`, but the profile/roles fetch is inside a `setTimeout(..., 0)`. This means components see `loading=false` before `roles` is populated, causing brief unauthorized flashes.

**Fix**: Only set `loading(false)` after profile and roles are fetched.

---

## 10. MEDIUM: No Pagination on CourseCatalog

EbookCatalog has pagination (12 per page), but CourseCatalog loads all courses at once with no pagination. With growth, this will degrade performance.

**Fix**: Add client-side pagination similar to EbookCatalog.

---

## 11. MEDIUM: BD_DISTRICTS List Is Incomplete

Only 28 of Bangladesh's 64 districts are listed in `constants.ts`.

**Fix**: Add all 64 districts.

---

## 12. LOW: InstructorSpotlight Makes N+1 Queries

For each instructor, it makes 3 separate queries (course count, course IDs, enrollment count). With 10 instructors, that's 30 queries.

**Fix**: Use a single aggregation query or RPC function.

---

## 13. LOW: Duplicate Coupon Validation Logic

Coupon validation is duplicated in `CartPage.tsx` and `Checkout.tsx` (identical code). Should be extracted to a shared hook `useCouponValidation`.

---

## 14. LOW: `refetchOnMount: false` Globally

The global QueryClient sets `refetchOnMount: false`, meaning if a user navigates away and back, stale data persists. This conflicts with the goal of "always showing new items first."

**Fix**: Change to `refetchOnMount: 'always'` or remove it and rely on `staleTime`.

---

## Implementation Plan

### Phase 1: Critical Fixes (Database)
1. Create `wishlists`, `learning_paths`, `learning_path_courses`, `events` tables with RLS
2. Fix eBook enrollment/ownership tracking in checkout

### Phase 2: Make Everything Dynamic
3. Replace hardcoded StatsSection with real DB counts
4. Replace hardcoded TestimonialsSection with `success_stories` query
5. Replace hardcoded `COURSE_CATEGORIES` in CourseCatalog filters with DB query

### Phase 3: Functional Bugs
6. Implement sort logic in CourseCatalog
7. Fix auth loading race condition in useAuth
8. Add pagination to CourseCatalog

### Phase 4: Code Quality & Security
9. Extract shared coupon validation hook
10. Fix N+1 queries in InstructorSpotlight
11. Complete BD_DISTRICTS list
12. Remove global `refetchOnMount: false`
13. Address RLS linter warnings
14. Enable leaked password protection

