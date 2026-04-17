

User wants two things:

1. **Player Shell redesign — match the reference exactly** (image-115):
   - **Header bar (above video)**:
     - Left: Website logo + name (e.g., "vibeable" badge in screenshot → use OTS logo + "Online Textile School")
     - Right: Help phone number with phone icon (`SITE_CONFIG.phone`)
   - **Footer bar (below video)**:
     - Center: User identity row → 👤 Full Name · 📞 Phone · ✉️ Email
     - This makes the watermark identity *visible* — psychological deterrent against screen recording/sharing
   - The current header (source badge + lesson title) and footer (playback controls/hint) are wrong — they don't match the reference.

2. **Video playback errors** (image-116): YouTube/Drive showing "Video player configuration error". Need to investigate the SecureMediaPlayer source detection — likely the recent refactor broke something. Will inspect.

Let me check the player source.

I have enough context from the recent diff & memory. The "configuration error" likely comes from the source-type detector failing to recognize the URL after the recent Drive normalization changes (e.g., URL passes through `extractDriveId` returning null for YouTube, then fallback path errors out), OR the iframe `src` is being built but the `type` check rejects it before render.

## Plan

### File 1: `src/components/media/PlayerShell.tsx` — redesign header & footer
Replace current header/footer slot content entirely. Shell becomes branded:

**Header (left → right)**:
```text
[OTS logo] Online Textile School        📞 01805136574 (Help)
```
- Logo: `src/assets/OTS_LOGO.png` 28px square, white bg rounded
- Site name: `font-heading font-semibold text-sm text-white`
- Right: phone icon + number, `text-xs text-white/80`, clickable `tel:` link

**Footer (centered, single row, wraps on mobile)**:
```text
👤 Md Mahbubul Alam   📞 01721001923   ✉️ user@email.com
```
- Pulls from `useAuth()` → `profile.full_name`, `profile.phone`, `user.email`
- Each item: icon (12px) + value, separated by subtle dot dividers
- `text-xs text-white/70 tabular-nums`
- Wraps to two lines on `<sm` screens
- This **identity strip** doubles as a visible deterrent (matches the watermark concept)

Keep the playback-controls hint OUT of the footer (move it as a small floating chip top-right of the video slot for embeds, or drop it — the user clearly wants the footer to be identity, not controls).

For direct uploads where we DO need playback controls, they stay overlaid on the video itself (auto-hide), since the footer is now reserved for branding/identity.

### File 2: `src/components/media/SecureMediaPlayer.tsx` — fix "configuration error" + wire new shell

**Fix the playback error**:
- Inspect the source-detection switch. Likely cause: after the Drive refactor, the `type` enum or the URL normalization returns `null`/throws for valid YouTube/Drive inputs, and the render path falls through to an error state.
- Concrete fixes expected:
  - Ensure `extractDriveId()` returns null gracefully for non-Drive URLs (don't throw)
  - Ensure YouTube/Vimeo detection runs BEFORE the Drive fallback
  - Ensure when `videoUrl` is a plain YouTube watch/shorts/embed URL, the embed `src` is built and the `<iframe>` renders (no "configuration error" thrown)
  - Add a defensive log: if no type matches, render a clear error with the offending URL (in dev) so future debugging is easy

**Wire the new shell**:
- `header` prop = branded header (logo + site name + help phone)
- `footer` prop = identity strip (name + phone + email from useAuth)
- Pass `lessonTitle` if needed via a small overline above the video, OR drop it entirely since the right sidebar already shows lesson title (per image-116)

### File 3: `src/lib/constants.ts` — verify `SITE_CONFIG.phone` exists (already does per UtilityBar/Footer)

## Result
- Player frame matches the screenshot exactly: branded header, video, identity footer
- All four sources (Direct, YouTube, Vimeo, Drive) play without "configuration error"
- Playback controls remain on the video itself (auto-hide overlay) for direct uploads
- Identity strip in footer = visible watermark = strong psychological deterrent

## Files

| File | Change |
|---|---|
| `src/components/media/PlayerShell.tsx` | Already takes header/footer slots — no change needed (just feed it different content) |
| `src/components/media/SecureMediaPlayer.tsx` | Build branded header (logo + site name + help phone), build identity footer (user name/phone/email), fix source-type detection so YouTube/Drive URLs no longer throw "configuration error", keep playback controls overlaid on video for direct uploads |

