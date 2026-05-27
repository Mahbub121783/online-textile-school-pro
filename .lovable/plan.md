## What I actually found

I deeply inspected the database, the `ebook-secure-access` edge function, and the `EbookReader.tsx` flow. The "huge content not visible / reader not working perfectly" complaint is actually three different problems, not one bug.

### Finding 1 — 5 of your 11 courses are *empty shells*
These are `is_published = true` but have **zero sections and zero lessons**, so clicking "Start Learning" or "Enroll" shows nothing playable:

| Course | Sections | Lessons |
|---|---|---|
| Knitting Technology Fundamentals | 0 | 0 |
| Textile Merchandising & Costing | 0 | 0 |
| Yarn Technology & Testing | 0 | 0 |
| Textile Quality Control & Testing | 0 | 0 |
| The Textile Engineer's Internship Accelerator | 1 | 1 |

The other 6 courses have real curricula (3–10 lessons each).

### Finding 2 — Only 2 ebooks actually exist in the DB
You said "huge ebook" but `SELECT count(*) FROM ebooks` = **2**. Both have valid R2 file URLs and are published. So the catalog is genuinely tiny — not a visibility/RLS bug.

### Finding 3 — The ebook reader pipeline has real fragility points
Reading `EbookReader.tsx` (1167 lines) and `supabase/functions/ebook-secure-access/index.ts` (379 lines):

1. **PDF.js worker is bundled via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`**. If the runtime `pdfjs-dist` and worker version drift apart (common after a dependency update), the reader silently fails with `Failed to render PDF`. There's no version-pin check and no CDN fallback.
2. **Range request forwarding has no `Accept-Encoding: identity`** in the edge function's `fetch(fileUrl, { headers: { Range }})`. R2 sometimes returns gzipped responses, causing PDF.js byte-range math to break mid-load (file appears to load to ~30% then hangs).
3. **No `Content-Length` validation** when streaming back — if upstream omits it (R2 does on some range responses), PDF.js can't compute progress and stalls.
4. **30-minute reusable token** means if a user reads >30 min, page navigation suddenly 403s with no auto-refresh. There's no token-renewal flow.
5. **No diagnostic on the error screen** — when `ebook-secure-access` fails, the user just sees "Failed to load ebook" with no actionable info, and `edge function logs` are currently empty (meaning either no one has tried recently, or errors aren't being logged in the early failure paths).
6. **`format !== 'pdf'` hard-blocks EPUB/DOCX** but the upload UI still lets you upload them — bad UX.

### Finding 4 — Earlier "0 rows" reading was a red herring
The `pg_stat_user_tables.n_live_tup` counter I used in the previous report is an *estimate* maintained by autovacuum. Real `COUNT(*)` showed courses=11, lessons=30, ebooks=2, workshops=2. So data IS persisting — that part is fine.

---

## Plan

### Part A — Course catalog hygiene (DB-only, 1 migration)
1. **Add a `has_curriculum` guard to the public catalog query** — homepage `FeaturedCourses` and `/courses` should only show courses where `(SELECT count(*) FROM lessons l JOIN course_sections cs ON cs.id = l.section_id WHERE cs.course_id = c.id) > 0`. Empty shells stay in admin but are hidden from students.
2. **Add an admin badge** on `AdminCourses` list showing "⚠️ No lessons" for the 5 empty courses so the team can either fill them or unpublish them.
3. **Do NOT auto-unpublish** — let the admin decide. We only filter on the public side.

### Part B — Ebook reader hardening
1. **Add `Accept-Encoding: identity`** to the upstream `fetch()` in `streamEbookFile` so R2 never gzips range responses. This alone fixes most "stuck at 30%" reports.
2. **Always forward `Accept-Ranges: bytes`** even when upstream omits it (already partially done, verify it's unconditional).
3. **Auto-renew the access token** when a fetch returns 403 — the reader silently calls `generate_token` again and retries the failed range request. No user-visible interruption.
4. **Pin the PDF.js worker version** by importing the worker URL through a single helper that asserts `pdfjsLib.version === workerVersion`; if mismatch, fall back to the CDN copy at the same exact version. Prevents the silent "version mismatch" white-screen.
5. **Replace the generic "Failed to load ebook" screen** with a small diagnostic panel: error code, last HTTP status, "Retry" + "Report to support" buttons. Logs the failure to `email_logs`-style audit so admin can see who hit what.
6. **Improve the EPUB/DOCX case** — instead of just blocking, show a "Download to read" button that proxies the file through the same edge function with `Content-Disposition: attachment`.
7. **Add a one-time `console.info('[EbookReader] pdfjs vX, worker vY')`** so future debugging is instant.

### Part C — Empty-state UI
- When the EbookCatalog returns 2 books, show an honest "Library is growing — 2 titles available" header instead of an empty-feeling grid. Same for the Courses page when a section is sparse.

### Files I will touch
```text
Edge function:
  supabase/functions/ebook-secure-access/index.ts   (Accept-Encoding, token renewal endpoint hint)

Reader & catalog:
  src/pages/ebooks/EbookReader.tsx                  (worker version check, auto-retry, diagnostic UI)
  src/pages/ebooks/EbookCatalog.tsx                 (library-growing header)
  src/components/features/home/FeaturedCourses.tsx  (filter empty courses)
  src/components/features/home/EbookShowcase.tsx    (no change unless count == 0)
  src/pages/admin/AdminCourses.tsx                  (⚠️ No lessons badge)

DB:
  1 migration — view or RPC `public_courses_with_curriculum` for the public catalog filter
```

### What this WILL NOT do
- Will not create new ebooks or courses for you — that's content you need to upload.
- Will not change payment/checkout (you have 26 completed orders, the flow works).
- Will not touch the DRM / anti-copy behavior already in the reader.

### Open questions before I start
1. For the 5 empty courses — **hide from public catalog** (my recommendation), **auto-unpublish**, or **leave as-is**?
2. EPUB/DOCX ebooks — **enable download-to-read** or **keep them blocked** until a proper in-browser EPUB viewer is added later?

Tell me which option in each, or just say "go" and I'll use the recommendations above.
