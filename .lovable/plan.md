# Fix: "Unable to load eBook" (404 from edge function)

## Root cause (confirmed)

The failing eBook is **"TEXTILE ENGINEER'S VIVA AND INTERVIEW PREPARATION — Wet Process Engineering"** (id `b4534ebc-bab1-41b6-a926-60b006d55679`).

Database check shows its `file_url` column is **empty** — the PDF was never actually uploaded to Cloudflare R2, but the eBook record was saved and published anyway. When students click "Read", the `ebook-secure-access` edge function looks up the file URL, gets nothing usable, and returns 404.

The R2 storage system itself is working — the other published eBook ("FABRIC SKEWNESS...") has a proper `pub-d06c...r2.dev/...pdf` URL and reads fine.

So this is **not** an R2/edge-function bug. It's a **data integrity + admin UX bug**: the admin form lets you save/publish an eBook without a file.

## Plan

### 1. Repair the broken record (immediate)
Re-upload the PDF for the failing eBook through the Admin → eBooks → Edit form so `file_url` becomes a valid R2 URL. This is a manual step the admin (you) does in the UI; no code change needed for this single fix, but the next steps make sure it never happens again.

### 2. Prevent empty-file eBooks from being saved/published
In `src/pages/admin/AdminEbooks.tsx` `saveMutation`:
- If `is_published === true` and `file_url` is empty/blank → block save with a clear toast: *"Cannot publish an eBook without a PDF file. Please upload the file to Cloudflare R2 first."*
- Allow saving as **draft** without a file (so admin can prepare metadata first), but never published.
- Also block if the upload is still in progress (`uploading === true`).

### 3. Audit + flag any other broken eBooks
Run a one-time check (already done — only this 1 record is broken today). Add a small visual indicator in the Admin eBooks list: rows with empty `file_url` show a red **"Missing file"** badge next to the storage badge so admins spot them at a glance.

### 4. Better error message in the reader
In `src/pages/ebooks/EbookReader.tsx` (and the secure-access edge function response), when the eBook has no `file_url`, return a friendlier message instead of a generic 404:
- Edge function: return `400` with `{ error: "This eBook has no file uploaded yet. Please contact support." }` when `file_url` is empty.
- Reader: detect that message and show *"This eBook is being prepared. Please try again later or contact support."* with a Contact button — not the raw "Edge Function returned non-2xx" technical error.

### 5. (Optional) Notify admins of broken eBooks automatically
Add a daily `pg_cron` job (or simple admin dashboard widget) that lists all published eBooks with empty `file_url` so the team is alerted before students hit the error.

## Files touched

- `src/pages/admin/AdminEbooks.tsx` — validation in `saveMutation`, "Missing file" badge in list
- `src/pages/ebooks/EbookReader.tsx` — friendlier error UI
- `supabase/functions/ebook-secure-access/index.ts` — early friendly response when `file_url` is empty
- (Optional) new migration for the cron-based admin alert

## What this does NOT change

- R2 storage configuration (working fine)
- The edge function's R2 streaming logic (working fine)
- Token / purchase validation (working fine)

Approve and I'll implement steps 2–4 (and 5 if you want it).
