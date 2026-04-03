
## Plan: Fix Ebook Uploads So They Truly Save to Cloudflare R2

### What I found
- The ebook form is already starting the upload on **Cloudflare R2**, not Cloudinary.
- In the preview snapshot, `AdminEbooks` called `r2-presign` and got back an R2 URL like `...r2.dev/...pdf`.
- The **Cloudinary URL you still see in the form is the old saved ebook URL**, not the new upload result.
- The real problem is that the new R2 upload is likely **failing before completion/save**:
  - files over **4.5MB** use the browser-to-R2 presigned upload path
  - that path depends on **R2 bucket CORS**
  - `AdminEbooks.tsx` currently has `catch {}` so upload failures are effectively hidden
- Database check shows there is still **at least 1 ebook record saved with a Cloudinary raw PDF URL**, so old ebooks are still legacy Cloudinary entries.

### Root cause
This is no longer mainly a routing bug.  
It is now a **silent failed R2 upload + old Cloudinary URL remains in the record** bug.

### Implementation plan

**1. Fix Admin Ebooks upload flow**
- Remove the silent `catch {}`
- Show clear states:
  - Uploading to Cloudflare R2
  - Upload failed
  - Uploaded to R2
  - Saved
- Replace the raw URL preview with a visible storage badge: `R2` or `Cloudinary`
- Disable `Create/Update` while ebook upload is still in progress
- Show the real error message if R2 upload fails

**2. Enforce Cloudflare-only for ebook files**
- Keep cover and gallery images on Cloudinary
- Force ebook `file_url` uploads to R2 only
- Add save-time validation in `AdminEbooks.tsx`:
  - if `file_url` is Cloudinary, block save
  - show “Ebook files must be stored on Cloudflare R2”

**3. Make large ebook uploads reliable**
- Add a dedicated **reliability-first ebook upload path**
- Best fix: support **chunked/proxied R2 upload** for large PDF/DOCX/EPUB files so ebook uploads do not depend on bucket CORS
- Keep the current presigned flow only as fallback or secondary path
- This is the most important hardening because ebook files are commonly larger than the proxy threshold

**4. Clean up legacy Cloudinary ebooks**
- Detect old ebook records whose `file_url` points to Cloudinary
- Mark them in admin UI as `Legacy` / `Needs R2 migration`
- Add a fast replace workflow so admin can re-upload and overwrite the old URL with R2
- This will fix the ebooks students currently cannot open

**5. Improve reader-side diagnostics**
- Keep `ebook-secure-access` tolerant for both legacy and R2 URLs during transition
- Return clearer errors for:
  - missing file
  - legacy Cloudinary raw URL
  - failed R2 fetch
- This makes support/debugging much easier while old records are being repaired

### Files to change
- `src/pages/admin/AdminEbooks.tsx`
  - remove silent failure
  - show upload status/source
  - block Cloudinary ebook URLs on save
  - add legacy badge/filter
- `src/hooks/useFileUpload.ts`
  - add a dedicated robust ebook upload mode
  - return richer status/error metadata
- `supabase/functions/r2-presign/index.ts`
  - add reliable large-file ebook upload support
- `supabase/functions/ebook-secure-access/index.ts`
  - improve legacy/R2 diagnostics and transition support

### Expected result
- Images continue uploading to **Cloudinary**
- Ebook files upload to **Cloudflare R2 only**
- Admin can immediately see whether the ebook is really stored on R2
- Large ebook upload failures are no longer silent
- Old Cloudinary ebook records can be found and replaced safely

### File summary
| File | Action |
|------|--------|
| `src/pages/admin/AdminEbooks.tsx` | Fix silent failures, show source/status, enforce R2-only save |
| `src/hooks/useFileUpload.ts` | Add robust ebook upload mode |
| `supabase/functions/r2-presign/index.ts` | Support reliable large ebook uploads |
| `supabase/functions/ebook-secure-access/index.ts` | Improve legacy-file diagnostics |

No migration is strictly required unless you want a dedicated `storage_provider` column for auditing.