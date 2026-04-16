

# Audit Result — Popup Storage Routing

## ✅ What's Already Correct

| Concern | Status | Evidence |
|---|---|---|
| No Supabase Storage usage in popups | ✅ Clean | `grep supabase.storage` in all popup files → **0 matches** |
| Images → Cloudinary | ✅ Working | `useFileUpload` checks MIME/extension, routes `image/*` to `cloudinary-proxy` edge function |
| Videos / heavy files → Cloudflare R2 | ✅ Working | Falls through to `uploadToR2Reliable` (chunked proxy, 4MB chunks, bypasses 4.5MB edge function limit) |
| No base64 stored in DB | ✅ Clean | Only `url` strings persisted to `popups` table |
| MediaPicker passes correct `accept` | ✅ Working | `image/*` for image field, `video/*` for video & background-video fields |
| External URLs (YouTube/Vimeo) | ✅ Working | Stored as plain text URL — no upload happens |

## ⚠️ Minor Issues Found

### 1. `accept='video/*'` blocks library browsing for video fields
The MediaPicker passes `accept='video/*'` to the OS file dialog (correct for upload), but in the **Library tab** the same `accept` indirectly limits what's shown if filtering is applied. Library filter buttons (`All / Image / Document / Video`) already let users pick any item, so this is OK — but a YouTube link saved earlier as text won't appear in `media_library` (it's never uploaded). **No fix needed** — paste-URL still works in the text input.

### 2. No visual confirmation of storage destination
After upload, the user has no indication whether the file went to Cloudinary or R2. For an admin tool dealing with this distinction explicitly, a small badge would help.

### 3. R2-uploaded videos not playable in `<img>` preview
In `PopupBuilder.MediaField`, only image previews render. Video/bg-video fields show only the URL text. A small `<video>` thumbnail preview for direct MP4s (R2-hosted) would be a nice polish — YouTube/Vimeo can't be previewed without iframe.

## 🛠️ Proposed Improvements

### File: `src/pages/admin/popups/PopupBuilder.tsx`

**A. Add storage badge after upload**
Track the upload `source` (returned by `useFileUpload`) and show a small chip:
- 🟢 `Cloudinary` for images
- 🔵 `Cloudflare R2` for videos/heavy files
- ⚪ `External URL` for pasted YouTube/Vimeo links

**B. Add lightweight video preview**
For video/bg_video fields, detect the URL type:
- YouTube/Vimeo → show provider icon + "Embed will play in popup"
- Direct `.mp4/.webm` → render `<video muted controls className="h-24 rounded border" />` thumbnail
- Other → show URL text (current behavior)

**C. Add inline help under each media field**
> "Images are auto-stored on Cloudinary. Videos/large files go to Cloudflare R2. You can also paste a YouTube/Vimeo link."

This makes the routing explicit and reassures the admin nothing heavy lands in Supabase.

### File: `src/components/shared/MediaPickerModal.tsx`

**D. After upload completes, show a one-line toast that names the destination** (e.g., "Uploaded to Cloudflare R2"). Currently just says "Uploaded!". Helps admins verify the routing rule visually.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/admin/popups/PopupBuilder.tsx` | Storage badge after upload, video thumbnail preview, helper text under media fields |
| `src/components/shared/MediaPickerModal.tsx` | Destination-aware success toast |

## What stays the same
- DB schema — no changes
- Routing logic in `useFileUpload` — already correct
- Edge functions (`cloudinary-proxy`, `r2-presign`) — already correct
- All existing popups continue working

## Confirmation
**Nothing in the popup system uploads to Supabase Storage.** The `media` storage bucket exists but is unused by popups. All file paths flow through `useFileUpload → Cloudinary or R2`.

