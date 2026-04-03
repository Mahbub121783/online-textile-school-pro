
Goal: fix the eBook reader so Cloudflare-hosted ebooks open fast and reliably.

What I found
- The file is already being returned successfully from `ebook-secure-access` as PDF bytes. So the main failure is not Cloudflare upload anymore.
- The current reader breaks because `src/pages/ebooks/EbookReader.tsx` loads the PDF worker from `cdnjs`, and that worker import is failing in the browser.
- The reader is also slow because it downloads the entire PDF with `response.arrayBuffer()` before rendering page 1.
- The current token flow is not compatible with proper PDF.js range loading because the secure endpoint is POST-based and the token is marked `used` immediately.

Implementation plan

1. Fix the PDF worker failure
- In `src/pages/ebooks/EbookReader.tsx`, stop using the external CDN worker URL.
- Bundle the worker locally with Vite and point `pdfjsLib.GlobalWorkerOptions.workerSrc` to that local asset.
- This removes the current “Setting up fake worker / Failed to fetch dynamically imported module” error.

2. Switch the reader to true incremental PDF loading
- Refactor `EbookReader` to stop doing:
  - secure fetch
  - `response.arrayBuffer()`
  - `getDocument({ data })`
- Instead, let PDF.js open the secure ebook URL directly with:
  - a GET endpoint
  - auth headers
  - range loading enabled
- Result: first page renders much faster and large PDFs no longer wait for a full download.

3. Upgrade `ebook-secure-access` for PDF.js range requests
- Add a GET-based streaming path in `supabase/functions/ebook-secure-access/index.ts` for PDF.js.
- Keep purchase validation and short-lived access tokens, but make tokens reusable until expiry instead of single-use on the first request.
- Forward and expose range-related headers properly:
  - `Accept-Ranges`
  - `Content-Range`
  - `Content-Length`
- Make the R2 S3 fallback honor incoming `Range` headers too, not just full-file fetches.

4. Harden reader behavior by format
- `EbookReader` currently assumes everything is a PDF.
- Add a clear format check using ebook metadata:
  - PDF: open in the secure PDF reader
  - non-PDF: show a proper unsupported-format message instead of a broken PDF error
- In `src/pages/admin/AdminEbooks.tsx`, tighten validation so the secure reader is aligned with the formats we actually support right now.

5. Keep Cloudflare-only enforcement for ebook files
- Preserve the existing R2-only validation in `AdminEbooks`.
- Keep the legacy Cloudinary warning/badge so old ebook records are easy to identify and re-upload.
- This prevents future mixed-storage ebook issues.

6. Recommended hardening for large uploads
- The current chunked upload flow in `supabase/functions/r2-presign/index.ts` still assembles large files inside the edge function.
- Replace that with native R2 multipart upload logic so large PDFs/docs do not depend on edge-function byte reassembly.
- This is the “advanced” stability improvement for big ebook files.

Technical details
- Frontend root cause: `pdf.worker.min.mjs` is being loaded from an external CDN and fails dynamic import.
- Performance root cause: whole-file download in the client before PDF.js starts rendering.
- Backend compatibility gap: PDF.js expects repeated ranged GET requests, but the current secure flow is single-use-token + POST body based.
- No database migration is required for this fix.

Files to update
- `src/pages/ebooks/EbookReader.tsx`
- `supabase/functions/ebook-secure-access/index.ts`
- `src/pages/admin/AdminEbooks.tsx`
- `supabase/functions/r2-presign/index.ts` (recommended hardening)

Expected result
- No more worker import error
- PDF page 1 appears much faster
- Large Cloudflare-hosted ebooks open reliably
- Range-based reading works without re-downloading the whole file
- Legacy Cloudinary ebook records are clearly identified instead of failing silently

Verification
- Test a small PDF and a large PDF from `/read/:ebookId`
- Confirm page 1 loads quickly and page navigation works
- Confirm no fake-worker warning in console
- Confirm edge function logs show successful secure reads without 500/502 errors
- Confirm a legacy Cloudinary ebook shows a clear admin-facing migration warning
