## Goal

Watch page ke TikTok / YouTube Shorts er moto **continuous vertical scroll feed** banano — ekta video sesh hole automatic next video (same category theke priority, then global) load hobe, infinite scroll cholbe. Mobile e card grid layout o improve kora hobe (better spacing, taller portrait-style preview, snappier touch targets).

## Part 1 — Reel-style Watch Feed (`ClassVideoWatch.tsx`)

Currently watch page ekta single video + sidebar related list dekhay. Eta full refactor hobe — full-screen vertical feed style.

### Behavior

- URL `/class-videos/:slug` open korle: oi video first slot e load hobe, ar same category theke baki published videos queue te add hobe (current ta exclude). Category sesh hole global newest videos append hobe (already-shown gula bad).
- Each "slot" = full viewport height (`h-[100dvh]` on mobile, capped on desktop e.g. `h-[calc(100vh-64px)]`) — ekta vertical snap container (`overflow-y-auto snap-y snap-mandatory`).
- IntersectionObserver: jei slot ≥70% visible, **only oi video play** hobe (full audio, full controls), baki sob pause. Active slot er video sesh hole (`onEnded`) auto-scroll next slot e (`scrollIntoView({ behavior: 'smooth' })`).
- URL sync: active video change hole `history.replaceState` diye URL slug update hobe — share korle exact video e land korbe, but page reload na.
- Infinite load: last 3 slot er moddhe pouchale next batch fetch (paginated by `created_at`).
- Each slot e overlay action rail (right side, TikTok style): Like, Comment count, Share, Category badge. Bottom overlay: title, description (truncated, expand-able), uploader, tags.
- Comments: bottom sheet / drawer (mobile) ba right panel (desktop ≥lg) — toggle by comment button. `CommentThread` reuse.
- View tracking: `useTrackVideoView` fire when slot becomes active for ≥2 seconds (debounced).

### New hook: `useVideoFeed(startSlug)`

Returns `{ videos, loadMore, isLoading }`. Internally:
1. Fetch the start video (by slug).
2. Fetch same-category videos (ordered by `created_at desc`, exclude start).
3. When exhausted, fetch global videos (exclude already-loaded ids) in batches of 8.
4. Dedup by id.

### Layout

- **Desktop (≥lg)**: centered video column (max-w `420px` for portrait videos, `min(900px, 80vh*16/9)` for landscape) + optional right panel for comments when toggled. Two-column: feed column + collapsible comments panel.
- **Mobile (<lg)**: full bleed, video fills viewport, overlay UI on top, snap scroll. No header/footer chrome on this page (hide global Header/BottomNav via a `fullBleed` prop or conditional render).

### Aspect handling

Videos can be landscape (YouTube) or portrait. We render inside a centered `aspect-[9/16]` frame on mobile with `object-contain` against a black/blur backdrop (so landscape YouTube videos still look clean — letterboxed on a blurred poster background).

## Part 2 — Mobile grid card improvements

`VideoCard.tsx` and grid containers in `ClassVideosHub`, `ClassVideoCategory`, `ClassVideosShowcase`:

- Mobile grid: change `grid-cols-2 gap-4` → `grid-cols-2 gap-3` with tighter padding; cards switch aspect from `aspect-video` (16:9) to `aspect-[3/4]` on mobile (`sm:aspect-video`) — more reel-like, more visible per scroll.
- Larger tap target: entire card tappable, "Play" overlay simplified (smaller icon on mobile), title font-size `text-[13px]` mobile / `text-sm` desktop, line-clamp-2.
- Stats row: hide likes/comments icon on `<sm`, keep only views to reduce visual noise.
- Visibility badge: smaller (`text-[9px] px-1`) on mobile.
- Add subtle `active:scale-[0.98]` for touch feedback.
- Showcase section (homepage): switch to horizontal scroll snap on mobile (`overflow-x-auto snap-x` row of cards) instead of 2-column grid — feels more like a YouTube shelf.

## Part 3 — Header/footer chrome on watch page

Watch page er global Header + BottomNav hide korte hobe immersive feel er jonno (mobile e). Achieve by:
- `App.tsx` route layout check kore `/class-videos/:slug` route e `Header` + `BottomNav` na render kora (or pass `hideChrome` prop). Existing pattern check korbo first.

## Technical Details

### Files to create
- `src/hooks/useClassVideoFeed.ts` — feed pagination hook (start video + category queue + global queue, dedup, loadMore).
- `src/components/class-videos/ReelSlot.tsx` — single full-height video slot with overlay actions, IntersectionObserver based play/pause, onEnded auto-advance, view tracking.
- `src/components/class-videos/ReelOverlayActions.tsx` — right-side action rail (like/comment/share/back).
- `src/components/class-videos/CommentsSheet.tsx` — Drawer (mobile) / Sheet (desktop) wrapping `CommentThread`.

### Files to edit
- `src/pages/class-videos/ClassVideoWatch.tsx` — full rewrite into reel feed container.
- `src/components/class-videos/VideoCard.tsx` — responsive aspect (`aspect-[3/4] sm:aspect-video`), smaller mobile overlay/badges, tap feedback.
- `src/components/features/home/ClassVideosShowcase.tsx` — horizontal scroll on mobile.
- `src/pages/class-videos/ClassVideosHub.tsx` & `ClassVideoCategory.tsx` — tighter mobile grid `gap-3`.
- `src/App.tsx` (or layout) — hide global chrome on `/class-videos/:slug`.

### Single-active-player coordination

Reuse existing `class-video-card-active` CustomEvent pattern, scoped by a different event name (`class-video-reel-active`) to avoid collision with grid card previews.

### URL sync without rerender

```ts
window.history.replaceState({}, '', `/class-videos/${activeSlug}`);
```
React Router state untouched, so `useClassVideo` hook doesn't re-fire.

### Auto-advance

```ts
<video onEnded={() => nextSlotRef.current?.scrollIntoView({ behavior: 'smooth' })} />
```
For YouTube iframe: use YouTube IFrame API (`enablejsapi=1` + postMessage listener for `onStateChange === 0`) to detect end.

### View tracking debounce

Slot active for 2s before insert into `class_video_views` — prevents view spam when user scrolls past quickly.

### Performance

- Only mount `<video>` / `<iframe>` for slots within ±1 of active index; others render poster + play icon. Reduces memory & autoplay battles on mobile.
- React Query `staleTime: 60s` for feed batches.

## Out of scope

- DB schema changes (none needed).
- Swipe gestures beyond native scroll snap (browser handles it).
- Picture-in-picture, fullscreen API integration (browser controls suffice).

No DB migration. No new dependencies.
