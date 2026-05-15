## Problem

Phase 2 added a `isPreviewOrEmbedded` gate to homepage data queries to reduce free-tier IO from the Lovable editor iframe. But that helper matches **any `lovable.app` / `lovableproject.com` hostname**, which is also where published apps live. Result: after publishing, real visitors see blank Featured Courses, eBooks, Instructors, Workshops, Testimonials, Sponsors, Learning Paths, Stats, Upcoming Events, Hero Slider — everything dynamic on the homepage.

This is wrong by design: blocking fetches kills the feature for users. Free-tier safety should come from **aggressive caching + dedup**, not from disabling fetches.

## Fix Strategy (keeps "A-Z advanced features within free usage")

### 1. Remove the `enabled: !isPreviewOrEmbedded` gate everywhere

Delete that line from all 9 homepage components + HeroSlider. Queries fetch normally for everyone.

Files to clean:
- `src/components/features/home/FeaturedCourses.tsx`
- `src/components/features/home/EbookShowcase.tsx`
- `src/components/features/home/InstructorSpotlight.tsx`
- `src/components/features/home/FeaturedWorkshops.tsx`
- `src/components/features/home/HeroSlider.tsx`
- `src/components/features/home/LearningPathsPreview.tsx`
- `src/components/features/home/SponsorsSection.tsx`
- `src/components/features/home/TestimonialsSection.tsx`
- `src/components/features/home/StatsSection.tsx`
- `src/components/features/home/UpcomingEvents.tsx`

Keep the existing tuning that **does** save free-tier without breaking UX:
- `staleTime: 10–30 min` → React Query serves cache, no refetch
- `retry: 0`, `refetchOnMount: false`, `refetchOnReconnect: false`
- Persistent localStorage cache (Phase 3 emon system)

These already give the "load once, cache in browser" behavior you wanted.

### 2. Repurpose `isPreviewOrEmbedded` correctly

Narrow the helper so it ONLY matches the Lovable **editor** iframe, not the published site:

```ts
export const isPreviewOrEmbedded = (() => {
  if (typeof window === 'undefined') return false;
  try {
    // Match ONLY the editor preview iframe (id-preview--*), never the published lovable.app site
    return (
      window.location.hostname.startsWith('id-preview--') ||
      // sandbox subdomain used by Lovable editor
      window.location.hostname.includes('sandbox.lovable')
    );
  } catch {
    return false;
  }
})();
```

This way the helper still exists for genuinely editor-only behaviour (e.g. skipping popup engine, skipping maintenance redirects) but never blocks the published app.

### 3. Audit other usage so nothing else breaks on publish

Check and confirm correct gating for:
- `src/App.tsx` — likely Meta Pixel / analytics gating, OK if it just skips analytics in editor
- `src/lib/maintenanceMode.ts` — should still skip maintenance check in editor only
- `src/hooks/usePopupEngine.tsx` — should still skip popups in editor only

After narrowing the helper, all of these keep working correctly in the published app.

### 4. Verify

- Open homepage on the preview URL after fix — Featured Courses, eBooks, Instructors etc. should populate (network tab shows the queries firing).
- Confirm React Query cache still holds across navigations (no double-fetch of the same key).
- Confirm published site (`lovable.app`) would also fetch (helper returns false there now).

## Free-Tier Impact

- Editor preview: still skips popups/analytics/maintenance via narrowed helper → no editor noise on free tier.
- Real users: get full dynamic homepage, but each unique view is cached for 10–30 min in React Query + localStorage (Phase 3 persister), so DB hits are minimal.
- Net effect: feature works A-Z, free tier still safe because of caching, not because of blocking.

## Out of Scope

No DB schema changes. No new dependencies. No edge function changes. Pure frontend revert + helper narrowing.
