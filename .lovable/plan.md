

## Goal
Remove the **DemoClassCTA** ("Try a Free Demo Class") section from the homepage and replace it with an advanced, dynamic **Featured Workshops** section that pulls live data from the `workshops` table.

## Why
- DemoClassCTA is static, fake (hardcoded "Dr. Rahman", non-functional email capture, no real video).
- The platform already has a full Workshops system (`/workshops` page, `workshops` table, `CountdownTimer`, registration counts) — homepage should surface it.

## Plan

### File 1: `src/components/features/home/FeaturedWorkshops.tsx` (NEW)
Advanced homepage workshops carousel/grid with the same visual language as `WorkshopsPage` but tuned for homepage:

**Data**:
- React Query → `workshops` table, filter `status IN ('published','ongoing')`, `start_date >= today`, `order by start_date asc`, `limit 6`
- Parallel query → `workshop_registrations` for live registration counts
- Skeleton state while loading; section hides itself if zero results

**Layout**:
- Section header: "Upcoming Workshops" + subtitle + "View all →" link to `/workshops`
- Desktop: 3-column grid (lg), 2-column (md), 1-column (sm)
- Each card (matches `WorkshopsPage` styling for consistency):
  - Square aspect thumbnail with gradient overlay
  - Status badge (Live/Upcoming) + type badge (One-Day/Multi-Day)
  - **CountdownTimer** overlay on image bottom (cinematic urgency)
  - Title, instructor (avatar + name)
  - Date + time row, slots-left indicator (red if full, green if available)
  - "View & Register" CTA button → navigates to `/workshops/{slug|id}`
- Hover: card lifts, image scales 105%, border highlights to primary
- Empty state: section returns `null` (no awkward "no workshops" on homepage)

**Mobile optimization**:
- Single column, full-width cards
- Reduced padding, smaller fonts
- Touch-friendly CTA buttons (h-10 min)

### File 2: `src/pages/Index.tsx`
- Remove `DemoClassCTA` lazy import (line 14)
- Remove `<LazySection><DemoClassCTA /></LazySection>` (line 78)
- Add `const FeaturedWorkshops = lazy(() => import('@/components/features/home/FeaturedWorkshops'));`
- Insert `<LazySection><FeaturedWorkshops /></LazySection>` in the same slot (between Testimonials and Sponsors) — keeps social-proof → engagement → partners flow

### File 3: `src/components/features/home/DemoClassCTA.tsx`
- Leave file in place (not imported anymore = tree-shaken). No deletion needed — keeps git diff clean and allows easy revert.

## Result
- Homepage no longer shows fake demo class
- Real, live workshops appear with countdown timers, registration counts, and direct links
- Reuses existing design system from `WorkshopsPage` for visual consistency
- Section auto-hides when no workshops are scheduled (no empty state on landing page)
- Mobile + desktop responsive

## Files Touched
| File | Change |
|---|---|
| `src/components/features/home/FeaturedWorkshops.tsx` | NEW — live workshops grid with countdown, badges, registration counts |
| `src/pages/Index.tsx` | Swap `DemoClassCTA` → `FeaturedWorkshops` |

