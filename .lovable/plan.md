# Plan: solve the login + Supabase overload without upgrading paid compute

## What I think is happening
Your screenshot shows Supabase resource exhaustion, so this is most likely a load/efficiency problem, not a broken schema.

From the codebase, there are several things that can overload a free Supabase project:
- the public homepage fires many separate Supabase queries
- `SEOHead` loads `site_settings` on many routes
- engagement tracking sends repeated Edge Function calls (`PageView`, `PageScroll`, `TimeOnPage`)
- auth boot does extra write work on login (`last_login_at`) and also tries avatar normalization through `cloudinary-proxy`
- dashboard/admin/instructor layouts keep realtime subscriptions open

That combination can exhaust free resources and then auth/login starts failing or timing out.

There is also one more possibility: Lovable preview sometimes breaks Supabase auth requests even when the real app is okay. So I want to verify both:
1. real overload from your Supabase free tier
2. preview-only login failure

## Implementation plan

### 1) Stop non-essential traffic first
I’ll reduce the requests that are not required for login or core browsing:
- temporarily disable or heavily throttle `TimeOnPage` and `PageScroll` server-side tracking
- keep only the essential `PageView` event, or turn Meta CAPI off entirely while debugging
- remove write-on-click behavior like sponsor `click_count` updates from public pages, or defer them
- ensure public pages do not trigger background writes

Why this matters: free Supabase gets stressed fastest by lots of small background requests.

### 2) Make auth bootstrap lightweight
I’ll simplify everything that runs immediately after sign-in / session restore:
- keep `getSession()` + minimal profile fetch
- prevent non-critical work during auth startup
- move avatar normalization out of `useAuth` so login does not invoke Cloudinary fetch + DB update
- make `last_login_at` update non-blocking and only run once after confirmed sign-in
- make auth resilient if profile/role fetch is slow, so session login still completes

Why this matters: login should not depend on image processing or extra writes.

### 3) Reduce homepage query pressure
The homepage currently loads many sections separately. I’ll reduce that load by:
- keeping only high-priority sections on initial load
- deferring or lazy-loading more sections after the page is visible
- replacing `select('*')` with small column lists where possible
- reducing duplicate settings/content fetches
- avoiding route-wide settings fetches when hardcoded fallbacks are enough

Main hotspots I found on the public side:
- hero slides + latest workshop
- stats section
- featured courses
- ebooks
- events
- learning paths
- testimonials
- sponsors
- instructors
- class videos
- `SEOHead` -> `useSettings()`

### 4) Limit realtime to where it truly matters
Realtime is useful, but on free tier it should be used carefully.
I’ll review mounted realtime hooks and make sure:
- only dashboard/admin/instructor screens use subscriptions
- public pages never subscribe unnecessarily
- channels are removed cleanly
- invalidations are not too broad

If needed, I’ll downgrade some live updates to manual refresh / normal query refetch.

### 5) Add safer caching defaults for low-cost operation
I’ll tune React Query behavior for a free-tier-friendly app:
- longer stale times for public content
- fewer automatic refetches
- avoid unnecessary refetch on remount for stable content
- keep critical auth/account data fresh, but let public marketing content stay cached longer

This lowers load without changing the user experience much.

### 6) Verify whether login failure is real app issue or preview-only issue
After optimization, I’ll test login carefully in two contexts:
- preview URL
- published/production app behavior pattern

Reason: Lovable preview can sometimes show `Failed to fetch` for Supabase auth even when the real deployment is fine. I will separate that from actual Supabase overload.

## Technical changes I expect to make
- `src/hooks/useAuth.tsx`
  - remove avatar normalization from auth bootstrap
  - minimize login-time writes
  - harden session/profile loading
- `src/hooks/useEngagementTracking.ts`
  - disable or reduce noisy tracking events
- `src/lib/metaPixel.ts`
  - limit server-side CAPI calls during debugging / free-tier mode
- `src/components/SEOHead.tsx`
  - avoid expensive repeated settings fetches on every route where not needed
- homepage sections under `src/components/features/home/*`
  - cut `select('*')`
  - reduce initial query count and defer non-critical sections
- `src/hooks/useRealtime.ts`
  - narrow realtime invalidation behavior if needed
- possibly selected public hooks like `useSettings`, `useSiteContent`, `useClassVideos`
  - stronger caching and lighter queries

## Expected result
After these changes, the app should:
- stop exhausting Supabase so quickly on free tier
- let users log in more reliably
- reduce background DB/Edge Function traffic
- keep the public homepage working with much lower cost

## Important note
If login still fails only inside Lovable preview after these optimizations, then the remaining issue is likely the preview auth proxy behavior, not your Supabase project itself. In that case I’ll give you the cleanest workaround path without asking you to upgrade compute.

## After approval
I’ll implement the low-cost optimization pass first, then re-check login behavior and identify whether any remaining problem is:
- true Supabase free-tier exhaustion
- a specific heavy query/page
- or a preview-only auth issue