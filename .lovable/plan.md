<final-text>Problem I pinpointed

- This is not an XML issue.
- `.htaccess` is only one part of the problem.
- The strongest root cause is your self-hosted FTP deployment leaving old Vite build files in place. Your workflow uploads `dist/` by FTP but does not clean stale hashed assets, which can create old/new JS chunk mismatches. That exactly matches the symptom: first load is broken or blank, second refresh works.
- There is also an app-startup weakness: auth/session boot is still fragile, so some protected pages can decide too early that the session is not ready.
- A few homepage render warnings (`Function components cannot be given refs`) should also be cleaned up because they add first-load instability.

What I will fix

1. Deployment and cache behavior
- Update `.github/workflows/deploy.yml` so deploys do not leave stale hashed files behind.
- Strengthen `public/.htaccess` for Apache:
  - keep SPA rewrite
  - disable cache for `index.html`
  - keep long cache only for hashed `/assets/*`
  - add `Options -MultiViews` and safer rewrite exclusions
- Keep the `ErrorBoundary` reload only as a fallback, not as the main fix.

2. Make auth initialization deterministic
- Refactor `src/hooks/useAuth.tsx` to expose a real auth-ready state.
- Handle the initial session consistently before redirects or user-bound queries run.
- Update protected layouts/pages to wait for auth readiness before redirecting.

3. Remove first-render weak points
- Fix the ref warnings in `src/pages/Index.tsx` and `src/components/features/home/StatsSection.tsx`.
- Review public loaders so pages never sit indefinitely on a plain `Loading...`.
- Keep immediate fallback content on the homepage and apply the same stability pattern where needed on other pages.

4. Make old UUID links self-heal
- For workshops, courses, and ebooks, if a page opens by old ID/UUID, redirect to the slug URL after load.
- This keeps SEO clean and avoids mixed old/new URLs.

Files likely involved
- `public/.htaccess`
- `.github/workflows/deploy.yml`
- `src/hooks/useAuth.tsx`
- `src/pages/dashboard/DashboardLayout.tsx`
- `src/pages/instructor/InstructorLayout.tsx`
- `src/pages/admin/AdminLayout.tsx`
- `src/pages/Index.tsx`
- `src/components/features/home/StatsSection.tsx`
- `src/pages/static/WorkshopDetail.tsx`
- `src/pages/courses/CourseDetail.tsx`
- `src/pages/ebooks/EbookDetail.tsx`

Technical note
- Your current `.htaccess` only handles SPA rewrite. It does not prevent stale Vite asset caching.
- Your current FTP deploy does not guarantee removal of outdated `/assets/*.js` files.
- That combination is the most likely reason you are seeing the double-refresh problem.

How I’ll verify after implementation
- Open `/`, `/about`, `/workshops`, one workshop detail, one course detail, one ebook detail, `/dashboard`, `/instructor`, and `/admin` directly in a fresh tab.
- Hard refresh each page once only and confirm it loads correctly on the first try.
- Verify after a fresh frontend deploy that old chunk files no longer break first load.
- Confirm old UUID links redirect to clean slug URLs.</final-text>