
Do I know what the issue is? Yes.

## Exact problem
I checked the current player code and your screenshot. The YouTube iframe is rendering, but `src/components/media/SecureMediaPlayer.tsx` sets `referrerPolicy="no-referrer"` on every embedded iframe. That strips the Referer/client identity header, which is why YouTube is returning **Error 153: Video player configuration error**.

There is also a second issue making embeds fragile:
- `SecureMediaPlayer` expects platform values like `drive`, `upload`, `direct`
- `LessonMakerTab` currently saves values like `google_drive` and `custom`

So even when the UI looks right, the saved video source config is inconsistent across the app.

## Fix plan

### 1) Fix the real YouTube failure in `src/components/media/SecureMediaPlayer.tsx`
- Remove the global `no-referrer` behavior for YouTube embeds
- Use a provider-specific iframe policy:
  - **YouTube:** allow origin/referrer (`strict-origin-when-cross-origin` or no forced `no-referrer`)
  - **Drive:** keep the stricter setup
  - **Others:** keep safe defaults
- Keep the branded header/footer exactly as they are now

### 2) Make source detection robust in the same file
- Normalize old and new platform aliases before parsing:
  - `google_drive` → `drive`
  - `custom` → handled safely as direct/embed depending on URL
- Expand YouTube URL parsing so all common formats work reliably:
  - `youtube.com/watch?v=...`
  - `youtu.be/...`
  - `youtube.com/embed/...`
  - `youtube.com/shorts/...`
  - `youtube-nocookie.com/embed/...`

### 3) Align the admin lesson form values
Update `src/pages/admin/course-management/LessonMakerTab.tsx` so newly saved lessons use the same canonical values the player expects:
- `youtube`
- `vimeo`
- `drive`
- `upload` / `direct`

### 4) Verify the secondary lesson form
Check `src/components/instructor/LessonModal.tsx` so it stays consistent with the same platform values and does not reintroduce mismatched config.

## Files to update
- `src/components/media/SecureMediaPlayer.tsx`
- `src/pages/admin/course-management/LessonMakerTab.tsx`
- `src/components/instructor/LessonModal.tsx`

## Expected result
- YouTube videos play again without Error 153
- The fix works in both:
  - Admin “Student Preview” modal
  - Actual lesson player page
- Existing lessons saved with old platform values still keep working
- Your branded player shell, header, footer, watermark, and Drive protections stay intact

## QA after implementation
Test these cases on desktop and mobile:
- `youtube.com/watch?v=...`
- `youtu.be/...`
- `youtube.com/shorts/...`
- Google Drive share link
- Direct uploaded MP4 / R2 video

Success = no YouTube configuration error, no broken branding, and no regression for Drive/direct playback.
