

## Goal
Add fully functional **Google Drive video integration** to the Secure Media Player, with strong anti-download protection matching the existing DRM behavior used for YouTube/Vimeo/direct uploads.

## Current State (verified from codebase)
- `src/components/media/SecureMediaPlayer.tsx` — unified DRM player. Per memory `secure-learning-player`, it already supports YouTube, Vimeo, Google Drive, and direct URLs with watermarks, no-download, encrypted last-position tracking.
- However: Drive support is currently the **basic `/preview` iframe**, which:
  - Shows Google's native 3-dot menu with **Download** and **Open in new tab**
  - Allows right-click → save in some browsers
  - Shows "Pop out" button on hover
  - Leaks the raw file URL via DevTools Network tab
- This is what the user means by "lacks functional Drive link with high-level encryption / no-download."

## The Problem with Drive
Google Drive's `/preview` embed is **not** designed for DRM. The file ID is exposed, the download button is part of Google's UI (cannot be removed via CSS due to cross-origin iframe), and `?usp=drivesdk` / `&rm=minimal` params only hide *some* chrome.

## Solution — Multi-Layer Drive DRM

### Layer 1: URL normalization & hardening
Auto-detect any Drive URL format the instructor pastes:
- `drive.google.com/file/d/{ID}/view`
- `drive.google.com/open?id={ID}`
- `drive.google.com/uc?id={ID}`
- Already-embed `/preview` URLs

Convert all to the **most locked-down embed**:
```text
https://drive.google.com/file/d/{ID}/preview?rm=minimal&usp=drive_web
```
with iframe attributes:
- `sandbox="allow-scripts allow-same-origin allow-presentation"` (blocks `allow-downloads`, `allow-popups`)
- `allow="autoplay; encrypted-media; fullscreen"` (no `clipboard-write`, no `picture-in-picture`)
- `referrerpolicy="no-referrer"`

### Layer 2: Visual overlay shield (the key trick)
A **transparent overlay div** sits on top of the Drive iframe covering only the top-right area where Drive's 3-dot menu / Pop-out / Download buttons appear (~48px tall strip on the right, ~120px wide). This:
- Blocks user clicks from reaching Drive's chrome
- Lets the video itself remain interactive (center play/pause area is uncovered)
- Combined with `pointer-events` masking, gives a play-only experience

```text
┌──────────────────────────[shield]──┐
│                              [X][⋮]│ ← overlay covers this
│                                    │
│         ▶ video area               │
│         (clickable)                │
│                                    │
└────────────────────────────────────┘
```

### Layer 3: Existing DRM protections (already implemented, just verify they apply to Drive too)
- Right-click disabled on player container
- DevTools detection (already in place — pause + warning)
- Dynamic watermark with `{user.email} · {timestamp}` overlay
- Keyboard shortcuts blocked: Ctrl+S, Ctrl+P, Ctrl+Shift+I, F12, PrintScreen
- `user-select: none`, `-webkit-touch-callout: none`
- No `download` attribute anywhere in DOM

### Layer 4: Instructor-side guidance
In `LessonModal.tsx`, when `video_platform === 'drive'` (new option):
- Show inline help: *"Set the Drive file's sharing to **'Anyone with the link → Viewer'**. In Drive, click the file → ⋮ → Share → toggle off 'Viewers and commenters can see the option to download'.*"*
- This is critical — without disabling Drive's *file-level* download permission, no client-side trick is bulletproof. We must educate instructors.

### Layer 5: Position tracking parity
Drive iframes don't expose `currentTime` (cross-origin). Existing player already handles this gracefully (skips DB save for unsupported sources). We add a clear note in the player: "Resume position not supported for Drive videos — use Direct Upload or Vimeo for full progress tracking."

## Files to Change

| File | Change |
|---|---|
| `src/components/media/SecureMediaPlayer.tsx` | Add `extractDriveId()` helper, hardened iframe attrs, top-right overlay shield, source-type detection for any Drive URL pattern |
| `src/components/instructor/LessonModal.tsx` | Add `'drive'` to `video_platform` Select; show instructor guidance card with Drive sharing settings when chosen |
| `src/locales/en.json` & `bn.json` | Add Drive helper text strings (bilingual) |

## What This Achieves
- Drive videos play inside the lesson with **no visible download button, no pop-out, no 3-dot menu**
- Right-click, Ctrl+S, F12, PrintScreen all blocked (parity with YouTube/Vimeo)
- File ID still technically inspectable in DOM (unavoidable for Drive embeds), but combined with file-level Drive sharing setting (no-download permission), users cannot save the video through normal means
- Instructors get clear guidance to enforce server-side restriction too

## What This Doesn't Achieve (honest disclaimer)
- A determined user with screen recording software can always capture playing video — true for Netflix, YouTube, every platform. No web DRM stops screen capture without Widevine L1 hardware DRM (not available to Drive embeds).
- For **maximum** protection on truly sensitive content, recommend instructors upload to **Cloudflare R2 + signed URLs** (already supported via Direct Upload path) rather than Drive — R2 path supports server-side token expiry.

