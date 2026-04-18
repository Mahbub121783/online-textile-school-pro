

## Answer + Plan

### Where files actually go (current state)

| Upload type | Goes to | Verified in |
|---|---|---|
| **User profile avatar** | ❌ Supabase Storage `media` bucket (`avatars/{user_id}.ext`) | `SettingsPage.tsx` line 107–117 |
| Course thumbnails, lesson images, blog covers, etc. | ✅ Cloudinary (via `useFileUpload` → `useCloudinaryUpload` → `cloudinary-proxy` edge fn) | `useFileUpload.ts` |
| eBooks (PDF), videos, large docs, archives | ✅ Cloudflare R2 (via `useFileUpload` → `r2-presign` chunked) | `useFileUpload.ts` |

So your finding is correct — **profile photos never reach Cloudinary**, they sit in Supabase Storage. That's why you see nothing in the Cloudinary dashboard for users. R2 is only for heavy files (PDFs, videos, archives), so unless someone uploaded an eBook, R2 will also be empty.

### Why this is a problem
- Inconsistent storage routing — bypasses the unified pipeline
- Avatars not registered in `media_library` (so they don't appear in the Media Picker)
- No Cloudinary optimization (`f_auto,q_auto`) on profile photos → bigger payload, slower
- Two storage systems to manage instead of one

### Fix Plan

**Single change**: Replace the Supabase Storage avatar upload in `SettingsPage.tsx` with the unified `useFileUpload` hook so avatars route to Cloudinary like every other image.

| File | Change |
|---|---|
| `src/pages/dashboard/SettingsPage.tsx` | Replace `handleAvatarUpload` to call `useFileUpload().upload(file)` → save returned URL to `user_profiles.avatar_url` → upsert into `media_library` |

After fix: every new profile photo will appear in your Cloudinary dashboard under the `uploads/` folder, and also show up in Admin → Media Library.

### What about existing avatars?
Old avatars stay where they are (Supabase Storage URLs in `avatar_url` column) and continue to work — they just won't migrate retroactively. If you want, I can also add a one-time migration script that re-uploads existing Supabase-hosted avatars to Cloudinary, but that's optional.

### About R2 being empty
That's expected unless users have uploaded:
- eBook PDFs
- Course videos / lesson video files
- ZIP / archive materials

R2 only receives files matching `HEAVY_EXTENSIONS` (pdf, mp4, zip, docx, pptx, etc.). Light images always go to Cloudinary.

