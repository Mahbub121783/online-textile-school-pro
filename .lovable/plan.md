

## What's actually happening

I checked the DB. Originals are fine on Cloudinary — e.g. a 1MB PNG is stored as 1MB, a 90KB WhatsApp photo as 90KB. **Nothing in our code compresses bytes before upload.** So the upload pipeline itself is OK.

The "small / over-compressed" look in your screenshot is from **how images are displayed**, plus a few real pipeline gaps:

1. **Display problem (main visual cause)**
   - The Cloudinary URLs we save have **no sizing transform** (e.g. `…/upload/v177…/uploads/abc.png` — no `f_auto,q_auto,w_…`).
   - The browser downloads the full original, then the page shrinks it visually inside small `aspect-square` cards using `object-cover`, which crops the subject and makes everything look tiny/grainy on the dark checker background you screenshotted.

2. **`publicId` not honored for general uploads**
   - `useCloudinaryUpload` already accepts `{publicId, folder}`, but `useFileUpload` (the hook used by **AdminMedia, MediaPickerModal, MediaUploader, all CMS forms**) never forwards them. So only the avatar follows the `users/{id}/avatar` rule — every other upload is dumped into `uploads/<random>`.

3. **Avatar auto-import from external sources is low-res**
   - `useAuth` silently re-uploads any external avatar URL (e.g. Google's `…=s96-c` 96px thumbnail) into Cloudinary. After that, your "Cloudinary" avatar is genuinely 96×96 because the source was 96×96.

4. **Old legacy rows still in the library**
   - Some entries point to Supabase Storage (`/storage/v1/object/public/media/...`) — they look different from new ones.

## Fix plan

### A. Display: render images through Cloudinary transforms
- Add a `cldImg(url, {w?, h?, ar?, c?})` helper in `src/lib/cloudinaryUrl.ts` that injects `f_auto,q_auto,w_…,h_…,c_fill,g_auto` into the existing secure URL (or returns the URL untouched if not Cloudinary).
- Update display sites:
  - `AdminMedia.tsx` grid/list thumbnails → 320w `c_fill,g_auto`; detail dialog → 1200w `c_limit`.
  - `MediaPickerModal.tsx` grid → 240w.
  - `MediaUploader.tsx` preview → 800w.
  - Avatars in `SettingsPage`, `Header`, chat, leaderboard, etc. → 200w `c_fill,g_face`.
  - Course/eBook/post thumbnails → 600w `c_fill`.
- Switch Media Library cards from `object-cover` to `object-contain` on a neutral background so users see the **actual** uploaded image, not a cropped slice.

### B. Upload: forward naming/folder for everything (not just avatars)
- Extend `useFileUpload.upload(file, options)` to accept `{ publicId?, folder? }` and pass them through to `useCloudinaryUpload`.
- Update callers to opt in:
  - **AdminMedia / MediaPickerModal / MediaUploader** → folder `uploads/{user_id}` so each user's uploads are grouped by their profile id (per your earlier request).
  - **CMS thumbnails (course/post/ebook/workshop)** → folder `content/{type}/{slug or id}`.
  - **Hero slides, sponsors, certificate templates** → folder `site/{section}`.

### C. Avatar quality safeguards
- Stop auto-normalizing Google profile thumbnails. In `useAuth.normalizeAvatarToCloudinary`:
  - Skip if URL contains `googleusercontent.com` and matches `=s\d+-c` → leave as-is OR upgrade `=s96-c` → `=s400-c` before importing.
  - Always store a "served" URL with `c_fill,g_face,w_400,h_400,f_auto,q_auto` while keeping the original public_id intact.

### D. Edge function tighten-up (`cloudinary-proxy`)
- Always send `unique_filename=false` and `use_filename=false` when `public_id` is supplied (already done).
- Keep upload at original quality (no `quality_analysis`, no `eager`); rely on delivery transforms (we never want byte-level recompression at upload).
- Add `resource_type=image` to the auto endpoint when MIME starts with `image/` so signed params line up; current `auto/upload` is fine but explicit avoids edge cases.

### E. Repair existing assets (you chose "Fix both")
One-time admin action behind a button in **AdminMedia → "Repair legacy & low-quality"**:
1. Scan `media_library` for rows whose `file_url` is Supabase legacy or whose Cloudinary URL has no transform path.
2. For each row, call `cloudinary-proxy` `fetch-url` to re-import into the proper folder/public_id.
3. Update `media_library.file_url` to the new Cloudinary URL (with `f_auto,q_auto`).
4. For users whose `avatar_url` came from Google `=s96-c`, re-import the upgraded `=s400-c` version.

Run as a queued, resumable job (similar to the existing migration worker), with progress UI and a Stop button.

## Files I'll change

| File | Change |
|---|---|
| `src/lib/cloudinaryUrl.ts` | Add `cldImg()` transform helper |
| `src/hooks/useFileUpload.ts` | Accept & forward `{publicId, folder}` |
| `src/hooks/useAuth.tsx` | Skip / upgrade Google `=s96-c` avatars |
| `src/pages/admin/AdminMedia.tsx` | Use `cldImg`, `object-contain`, add Repair button |
| `src/components/shared/MediaPickerModal.tsx` | Thumbnails via `cldImg`, pass `folder: uploads/{userId}` |
| `src/components/instructor/MediaUploader.tsx` | Same as above |
| `src/pages/dashboard/SettingsPage.tsx` | Avatar URL through `cldImg(…, {w:200, c:'fill', g:'face'})` |
| `src/components/layout/Header.tsx` (avatar) | `cldImg` for header avatar |
| `supabase/functions/cloudinary-proxy/index.ts` | Minor: explicit resource_type, ensure no recompression flags |
| `supabase/functions/migrate-storage-to-cloud/index.ts` (or new `repair-media`) | Add "repair" action that re-imports rows |

## Result

- Thumbnails are sharp (Cloudinary delivers right-sized WebP/AVIF), no apparent compression.
- Originals stay full-quality on Cloudinary, organized by user ID / content scope.
- Google-signed-up users no longer end up with a 96×96 avatar.
- Existing low-quality rows can be re-imported with one click.

