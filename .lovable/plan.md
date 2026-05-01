# Fix: Image previews not rendering on Media Library

## What you're seeing
On `/admin/media`, file rows load correctly (filename, size, source badge — Cloudinary, R2, Supabase legacy), but image **thumbnails render as broken images** (only the alt-text `Orange and Black Corporate Event…`, `WhatsApp Image…`, `asutex.png`, etc. is visible).

## Root cause (almost certainly remix-related)

The `media_library` table was carried over during the remix, but the assets it points to live in **external storage accounts that belong to the original project**, not yours:

- **Cloudinary URLs** (`https://res.cloudinary.com/<old-cloud-name>/image/upload/.../foo.png`) — the `<old-cloud-name>` is the original owner's Cloudinary account. Your remix doesn't have credentials to that account, but more importantly the URLs themselves point to a cloud you don't own.
- **R2 URLs** — same situation; signed/public URLs point to the original owner's R2 bucket.
- **Supabase legacy URLs** — these point to the *original* Supabase project's storage bucket (different project ref), so they 404 from your new project.

Your **new** Cloudinary + R2 accounts (the credentials you just configured in `Setup → Cloudinary` and `Setup → R2`) are healthy and ready, but no files have been uploaded **into them** yet — so the existing `media_library` rows are essentially dead pointers.

The code itself (`AdminMedia.tsx`, `cldImg`, `handleImgError`) is correct. It's a **data/asset ownership problem**, not a code bug.

## Verification steps (I'll run these first)

1. Query `media_library` for a few sample rows and confirm the cloud_name in the URLs does **not** match any nickname/cloud_name in your `cloudinary_accounts` table.
2. Query `cloudinary_accounts` and `cloudflare_r2_accounts` to confirm at least one active account exists per category (images / documents / video / R2).
3. Hit one of the failing Cloudinary URLs from a script to see the exact response (404 / 401 / unauthorized).

## Fix options

You only need to pick one — I recommend **Option A**.

### Option A — Clean slate (recommended, fastest)
Delete all `media_library` rows that point to the previous owner's storage. The library will be empty, and any new uploads (via the "Upload Files" button or via instructor/admin forms) will land in **your** Cloudinary/R2 and show up correctly.

```text
DELETE FROM media_library
WHERE file_url LIKE '%res.cloudinary.com%'
   OR file_url LIKE '%/storage/v1/object/public/%'
   OR file_url LIKE '%r2.cloudflarestorage.com%'
   OR file_url LIKE '%r2.dev%';
```

I'll write this as a reversible migration (with a backup table `media_library_remix_backup` first, so nothing is truly lost).

### Option B — Re-import via "Repair legacy & low-quality"
Your `AdminMedia` page already has a **"Repair legacy & low-quality"** button that calls `cloudinary-proxy → fetch-url` to re-upload remote images into your Cloudinary. This works **only if the original URLs are publicly fetchable**. For the previous owner's Cloudinary, they likely are — so this could rescue the image thumbnails. PDFs and R2-hosted files cannot be repaired this way.

I'll prepare both and let you pick.

### Option C — Do nothing, just upload fresh
If you don't care about the old library content, just start using the **"Upload Files"** button. New uploads will work immediately and show thumbnails. The dead rows will just sit there with broken previews until cleaned up.

## What I'll do once you approve

1. Run a quick DB check (sample `media_library` rows + your `cloudinary_accounts` / `cloudflare_r2_accounts` config) and report what I find.
2. Apply **Option A** by default (with backup table) — say "use B" or "use C" if you prefer.
3. Test by uploading one image via `/admin/media` and confirming the thumbnail renders.
4. Optionally run **Repair** to attempt re-importing any salvageable old Cloudinary images.

## Out of scope
No code changes are needed — `AdminMedia.tsx`, `cldImg`, `MediaUploader`, and the `cloudinary-proxy` / `r2-presign` edge functions are all working correctly.
