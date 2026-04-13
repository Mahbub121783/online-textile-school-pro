

# Remaining Issues Audit

## Status of Previous Fixes

| Fix | Status |
|-----|--------|
| Auth deadlock (no `await` in `onAuthStateChange`) | DONE - verified in `useAuth.tsx` |
| Instructor discovery RLS policy | DONE - migration applied |
| StatsSection `forwardRef` fix | DONE - `CountUp` uses ref on `div` directly |
| `as any` casts removed (pages, posts, payment_gateways) | DONE |
| Dynamic site content system | DONE |

## Remaining Issues (3 found)

### Issue 1: `forwardRef` Warnings (3 console errors still active)

The console shows 3 warnings:
- **InstructorSpotlight** - used via `React.lazy()` which tries to forward a ref, but the component is a plain function
- **Skeleton** - used inside InstructorSpotlight, no `forwardRef`
- **Badge** - used inside FeaturedCourses (also lazy-loaded), no `forwardRef`

**Fix**: Add `React.forwardRef` to `Skeleton` and `Badge` (UI primitives should support refs). Wrap `InstructorSpotlight` and `FeaturedCourses` default exports with `forwardRef` or use `memo` which handles the lazy ref issue.

### Issue 2: `admin_activity_log as any` Cast

In `AdminDashboard.tsx` line 97, `admin_activity_log` is still cast with `as any`. This table likely doesn't exist in the generated types yet, meaning the table may not exist or types are stale.

**Fix**: Check if `admin_activity_log` table exists. If not, either create it or remove the query. If it exists but types are stale, remove the `as any` cast.

### Issue 3: Enrollment Query Fetches ALL Enrollments

In `InstructorSpotlight.tsx` line 48-49, the query fetches ALL enrollments without filtering by course IDs, then filters client-side. This is a performance issue that will worsen with data growth.

**Fix**: Add `.in('course_id', allCourseIds)` filter to the enrollments query.

## Files to Edit

1. `src/components/ui/skeleton.tsx` - add `forwardRef`
2. `src/components/ui/badge.tsx` - add `forwardRef`
3. `src/components/features/home/InstructorSpotlight.tsx` - add `forwardRef` wrapper + fix enrollment query
4. `src/components/features/home/FeaturedCourses.tsx` - add `forwardRef` wrapper
5. `src/pages/admin/AdminDashboard.tsx` - fix or remove `admin_activity_log as any`

## Technical Details

For `Badge` and `Skeleton`, the pattern is:
```typescript
const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
  )
);
Skeleton.displayName = "Skeleton";
```

For lazy-loaded components, wrap the default export:
```typescript
export default React.forwardRef<HTMLElement>((_, ref) => <InstructorSpotlightInner />);
```

