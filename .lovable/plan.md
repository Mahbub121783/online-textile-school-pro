## Goal

Three improvements to the Reels-style Class Video feed:

1. **Stable autoplay** — only the active reel plays; previous one always pauses, even on fast scrolling.
2. **Persistent like + view tracking** — likes survive reload, views increment once per user/session per video.
3. **Swipeable comments sheet** — opens for the active video, supports replies, shows loading skeletons, draggable to dismiss.

---

## 1. Stable autoplay (`ReelSlot.tsx` + `ClassVideoWatch.tsx`)

Current bug: when scrolling fast, the IntersectionObserver may not fire `isActive=false` on the previous slot before the next one starts, so two videos can briefly play. YouTube iframes also don't pause when isActive flips because we re-render the iframe instead of commanding it.

Fixes:

- **Single source of truth for active**: keep `activeIndex` in `ClassVideoWatch`, but additionally pause *every* `<video>` that isn't the active one inside `ReelSlot` whenever `isActive` changes (using a `useEffect` that calls `videoRef.current.pause()` and resets currentTime in the unmount/inactive branch).
- **Listen to a global "active changed" event in every slot**: when a slot receives the event and its own id ≠ active id, force-pause its `<video>` and, for YouTube, post `{event:'command', func:'pauseVideo'}` to the iframe via `contentWindow.postMessage`.
- **YouTube control via postMessage**: switch the embed URL to include `enablejsapi=1` and keep the iframe mounted across active/inactive transitions (no remount on mute toggle). Add helper `sendYTCommand(iframe, 'pauseVideo' | 'playVideo' | 'mute' | 'unMute')` in `src/lib/youtube.ts`.
- **Scroll-end debounce**: in `ClassVideoWatch`, after scroll stops (150ms), recompute the slot whose center is closest to viewport center and force-set it as active. This guarantees correctness after fast flicks where IO ratios are noisy.
- **Tighten IO threshold**: keep observer but only mark active when `intersectionRatio >= 0.7` AND it is the highest. Pause all others immediately when active changes.

---

## 2. Persistent likes + per-user view tracking

### Likes
Already persisted via `class_video_likes` (UNIQUE on video_id+user_id). Improvements:

- Add **optimistic update** in `useVideoLike.toggle` so the heart and counter flip instantly and roll back on error.
- Update the cached `likes_count` on the video object in the React Query cache (so the rail count is always correct without refetch).
- Show login toast + redirect-to-login link when a guest taps like (current code only toasts).

### Views
`class_video_views` has no UNIQUE constraint, so the current `INSERT` on every 2-second activation inflates counts (multiple per scroll). Migration + hook update:

- **Migration**:
  - Add `UNIQUE (video_id, user_id)` for authenticated views.
  - For anonymous views, add a `session_key text` column and `UNIQUE (video_id, session_key) WHERE user_id IS NULL`.
  - The existing `tg_class_video_views_count` trigger already increments `views_count`, so it will only fire on genuine new rows (insert ignored on conflict → no count bump).
- **`useTrackVideoView`**: switch to `.upsert(..., { onConflict: 'video_id,user_id', ignoreDuplicates: true })` for logged-in users and a session-key based upsert for anon (key stored in `localStorage` as `cv_session_key`).
- **Trigger view only when watched ≥ 3s AND video is the active one** (prevents counting fast scroll-throughs). Use a per-slot `viewedRef` (already exists) but reset it when the slot becomes inactive so re-entry can re-evaluate (still deduped server-side by unique constraint).

---

## 3. Swipeable comments sheet (`CommentsSheet.tsx` + `CommentThread.tsx`)

Currently the sheet uses shadcn `Sheet` from the bottom but isn't drag-to-dismiss and the loading state is a basic skeleton inside the thread. Open behavior is per-video already.

Changes:

- **Open for active video**: `ClassVideoWatch` already sets `commentsFor` to a specific video id; ensure tapping the comment button while scrolling closes any open sheet for the prior video and opens for the new one. Add a `useEffect` that, when `activeIndex` changes and the sheet is open, swaps `commentsFor` to the new active video id (so the user keeps the panel open and sees the new video's comments).
- **Swipe-to-dismiss**: wrap the `SheetContent` body in a small drag handler (pointer events) — when user drags down past 80px or with velocity > 0.5px/ms, close the sheet. Add a visible drag handle bar at the top.
- **Reply support**: already implemented in `CommentItem`, keep — confirm the reply textarea is visible inside the sheet and the keyboard doesn't cover it (add `pb-[env(safe-area-inset-bottom)]` and make the comment list scroll independently of the input).
- **Sticky composer**: pin the "Add a comment" textarea to the bottom of the sheet so it's always reachable; comment list scrolls above.
- **Loading skeletons**: replace the 3 generic `Skeleton h-20` blocks with a `CommentSkeleton` component that mimics avatar + 2 text lines + action row, rendered 5x while `isLoading`. Also show skeletons for the active video header (title + counts) until the first batch resolves.
- **Inline reply skeleton**: when posting, optimistically append the comment with a "Posting…" muted state and reconcile on success.

---

## Files

**New**
- `src/components/class-videos/CommentSkeleton.tsx` — avatar + lines skeleton

**Edited**
- `src/lib/youtube.ts` — add `sendYTCommand` helper, `enablejsapi=1` in embed URL
- `src/components/class-videos/ReelSlot.tsx` — keep YouTube iframe mounted, drive play/pause via postMessage, listen to active-changed event, force-pause on inactive
- `src/components/class-videos/CommentsSheet.tsx` — drag-to-dismiss, sticky composer, drag handle, follow active video
- `src/components/class-videos/CommentThread.tsx` — swap loading state to use `CommentSkeleton`, sticky bottom composer layout
- `src/hooks/useClassVideos.ts` — optimistic like update, session-key view tracking with upsert
- `src/hooks/useVideoComments.ts` — optimistic comment insert
- `src/pages/class-videos/ClassVideoWatch.tsx` — debounced scroll-end snap correction, sync `commentsFor` with `activeIndex` while sheet is open

**Migration**
- Add `session_key text` to `class_video_views`; add UNIQUE indexes (one for `user_id NOT NULL`, one for anon by `session_key`).

---

## Technical notes

```text
[scroll]
   ↓
[IO sets candidate active]
   ↓ (150ms debounce after scroll stops)
[snap-correct: pick slot with center nearest viewport center]
   ↓
[setActiveIndex]
   ↓ broadcast 'reel-active' event
   ↓
each slot: if id !== active → pause <video> OR postMessage('pauseVideo')
active slot: play() / postMessage('playVideo')
```

View dedup: `upsert({video_id, user_id|session_key}, { onConflict, ignoreDuplicates: true })` → trigger only fires on real inserts.