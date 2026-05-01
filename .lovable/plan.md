## Goal

Thumbnail URL field bad — VideoCard te direct video preview show korbe, hover korle (desktop) ba scroll korle (mobile) auto-play hobe — YouTube Shorts / reel-style.

## Changes

### 1. Admin form (`AdminClassVideos.tsx`)
- "Thumbnail URL" field puro shoriye dewa hobe.
- `thumbnail_url` save payload theke o bad — column thakbe DB te (legacy), kintu ar UI theke set hobe na. Existing rows er thumbnail_url use kora bondho.

### 2. VideoCard (`VideoCard.tsx`) — Reel-style preview
Three behavior modes by source:

- **upload / drive**: `<video>` tag, `muted playsInline preload="metadata"`. 
  - Desktop: `onMouseEnter` → `play()`, `onMouseLeave` → `pause()` + `currentTime = clipStart`.
  - Mobile: `IntersectionObserver` (≥60% visible) → `play()`, leaving viewport → `pause()`. Only one card plays at a time (broadcast pause via custom event).
- **youtube**: YouTube er thumbnail auto-derive (`https://img.youtube.com/vi/<id>/hqdefault.jpg`) ar hover-e iframe e replace (`autoplay=1&mute=1&controls=0&start=X&end=Y&loop=1`). Mobile e same intersection logic.

Helper: `getYoutubeId(url)` — both `youtube.com/watch?v=` ar `youtu.be/` shapes handle korbe.

Card aspect: existing `aspect-video` thakbe (reel-style portrait noy, ami "reel-er moto kaj korbe" = auto-play behavior bujhsi; layout 16:9 ee thakbe). Confirm korle portrait `aspect-[9/16]` o korte pari.

Overlay: play button + visibility badge + duration thakbe; hover-e dim overlay video preview er upore hobe na.

### 3. ClassVideosShowcase (homepage) ar Hub/Category page
Existing — kichu change na, VideoCard refactor sob jaygay propagate korbe.

### 4. Type/hook
`ClassVideo.thumbnail_url` field type-e thakbe (DB column ase) — code ignore korbe.

## Technical notes

- `<video>` `crossOrigin` na set korle CORS issue hobe na karon shudhu play; metadata preload bandwidth kombe.
- Drive direct play kichu URL e kaj korena — fallback hisebe gradient + Play icon dekhabo (existing pattern).
- Single-active-player: ekta `videoCardActive` window CustomEvent dispatch korbo play hole; sob other card listen kore nije ke pause korbe.
- YouTube iframe er moddhe `enablejsapi=1` lagbena karon hover-out e iframe ke unmount kore dewa hobe (back to thumbnail).

## Files

- `src/pages/admin/AdminClassVideos.tsx` — remove thumbnail input + save logic.
- `src/components/class-videos/VideoCard.tsx` — full rewrite with hover/intersection auto-preview.
- (Optional) `src/lib/youtube.ts` new helper for `getYoutubeId` / `getYoutubeThumb`.

No DB migration needed.