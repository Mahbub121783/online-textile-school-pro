

## Plan: Fix Ebook File Storage Routing & Reader Access

### Problems Identified

1. **Upload routing is correct in code** — `useFileUpload` already routes PDFs/docs to R2 and images to Cloudinary. The hook logic is sound.

2. **Ebook reader fails with 502** — The `ebook-secure-access` edge function fetches `ebook.file_url` directly via `fetch()`. If the R2 public domain URL is misconfigured, unreachable from Deno edge functions, or if old ebooks have Cloudinary URLs that expired/changed, the fetch fails silently with "Failed to fetch ebook file".

3. **No fallback or diagnostics** — The edge function doesn't log the URL it's trying to fetch, doesn't retry, and doesn't distinguish between R2 vs Cloudinary URLs.

4. **Possible old data** — Ebooks uploaded before R2 was configured may have Cloudinary URLs for their `file_url`, which Cloudinary may reject for non-image files (PDFs uploaded via the auto/upload endpoint have limited access).

### Fixes

**1. Improve `ebook-secure-access` edge function** — Add robust fetching:
- Log the `file_url` being fetched for debugging
- If the URL is an R2 URL and public fetch fails, fall back to fetching via S3 SDK directly (server-side, no CORS issues)
- Add proper error details in the 502 response (URL domain, status code from upstream)
- Handle both Cloudinary and R2 URLs gracefully

**2. Add S3 direct-fetch fallback in the edge function** — When `file_url` points to R2 but the public domain fetch fails, use the S3 SDK with credentials from `cloudflare_r2_accounts` to fetch the file directly via `GetObjectCommand`. This bypasses any public domain or CORS issues.

**3. Enforce R2 for ebook file uploads in `AdminEbooks.tsx`** — Add an explicit check: when uploading `file_url` (not cover), force R2 routing regardless of file type. Currently the hook routes correctly, but add a safety comment and potentially a dedicated `uploadToR2` method exposed from the hook.

**4. Add `forceR2` option to `useFileUpload`** — Allow callers to bypass the image/heavy detection and force R2 for specific uploads (ebook files should always go to R2).

### Technical Details

**Edge function changes (`supabase/functions/ebook-secure-access/index.ts`):**
- Import S3Client and GetObjectCommand (same pattern as r2-presign)
- After initial `fetch(ebook.file_url)` fails, check if URL contains an R2 domain pattern
- Query `cloudflare_r2_accounts` to find the matching account
- Extract the file key from the URL and use `GetObjectCommand` to stream the file directly
- Log the URL and failure reason for debugging

**Hook changes (`src/hooks/useFileUpload.ts`):**
- Add `forceR2?: boolean` option to the `upload` function
- When `forceR2` is true, skip the image check and always route to R2
- Export this option in the interface

**AdminEbooks changes (`src/pages/admin/AdminEbooks.tsx`):**
- When uploading `file_url`, pass `{ forceR2: true }` to ensure ebook files always go to R2

### File Summary

| File | Action |
|------|--------|
| `supabase/functions/ebook-secure-access/index.ts` | Add S3 direct-fetch fallback, better error logging |
| `src/hooks/useFileUpload.ts` | Add `forceR2` option to upload function |
| `src/pages/admin/AdminEbooks.tsx` | Use `forceR2: true` for ebook file uploads |

3 file changes, no migration needed.

