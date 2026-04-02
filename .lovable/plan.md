

## Plan: Advanced eBook System Overhaul

### Critical Issues Found

| Issue | Severity | Details |
|-------|----------|---------|
| **`ebook-secure-access` edge function does not exist** | CRITICAL | The reader calls `supabase.functions.invoke('ebook-secure-access')` but this function was never created. This is the 100% loading issue — every reader attempt fails |
| **No streaming/chunking** | High | The reader downloads the entire PDF into memory via `arrayBuffer()` — huge files hang the browser |
| **Reader not responsive on mobile** | High | Canvas-based rendering doesn't adapt well; notes panel overlaps on small screens |
| **No admin ebook upload integration with MediaUploader** | Medium | Admin uses raw `<input type="file">` instead of the reusable `MediaUploader` component |
| **No profile progress widget in dashboard** | Medium | `useProfileCompleteness` hook exists but no visible widget in student dashboard |
| **No reviews/ratings on ebooks** | Medium | Course reviews exist but no ebook review system |

### Implementation Plan

**Phase 1: Fix the Critical Loading Issue (ebook-secure-access edge function)**

Create `supabase/functions/ebook-secure-access/index.ts`:
- **`generate_token` action**: Verifies user purchased the ebook (checks `order_items` + `orders`), creates a short-lived token in `ebook_access_tokens` table (expires in 10 min)
- **`stream_file` action**: Validates token, fetches `file_url` from `ebooks` table using service role, proxies the file bytes back to the client with proper headers (`Content-Type: application/pdf`, `X-Ebook-Title`)
- Uses range request support so the browser can load pages incrementally
- Includes DRM headers: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`

**Phase 2: Responsive Reader Improvements**

Edit `src/pages/ebooks/EbookReader.tsx`:
- Mobile: hide notes panel by default, show as bottom sheet overlay instead of sidebar
- Add pinch-to-zoom support on mobile
- Show loading skeleton per-page instead of blank screen
- Add table of contents / page thumbnail navigation drawer
- Fix canvas sizing: use `ResizeObserver` to re-render on viewport change
- Add "scroll mode" option (continuous scroll vs page-by-page)

**Phase 3: Admin eBook Upload Upgrade**

Edit `src/pages/admin/AdminEbooks.tsx`:
- Replace raw `<input type="file">` with `MediaUploader` component for cover image
- Add upload progress indicator for PDF file uploads
- Add drag-and-drop for gallery images
- Add bulk publish/unpublish

**Phase 4: Profile Progress Widget**

Create `src/components/ProfileCompletenessWidget.tsx` (if not exists, or verify):
- Circular progress ring showing completion percentage
- List of missing fields with links to profile page
- Add to `DashboardOverview.tsx`

**Phase 5: eBook Store Enhancements**

Edit `src/pages/ebooks/EbookCatalog.tsx`:
- Add sort options (price, newest, popular, rating)
- Add price range filter
- Add grid/list view toggle
- Add pagination (currently loads all ebooks at once)

Edit `src/pages/ebooks/EbookDetail.tsx`:
- Add related ebooks section
- Add review/rating system for purchased users (reuse `course_reviews` pattern → new `ebook_reviews` or extend existing)
- Add share buttons
- Add "preview first 3 pages" for non-purchased users

### Database Changes

```sql
-- No new tables needed. The ebook_access_tokens table already exists.
-- We only need the edge function.
```

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/ebook-secure-access/index.ts` | Secure token generation + file streaming proxy |

### Files to Edit

| File | Changes |
|------|---------|
| `src/pages/ebooks/EbookReader.tsx` | Mobile responsive, scroll mode, ResizeObserver, TOC drawer |
| `src/pages/ebooks/EbookCatalog.tsx` | Sort, filter, pagination, grid/list toggle |
| `src/pages/ebooks/EbookDetail.tsx` | Related ebooks, preview pages, share |
| `src/pages/admin/AdminEbooks.tsx` | MediaUploader integration, bulk actions |
| `src/pages/dashboard/DashboardOverview.tsx` | Add ProfileCompletenessWidget |
| `src/pages/dashboard/MyEbooks.tsx` | Add reading stats summary |

### Implementation Order

1. **Step 1**: Create `ebook-secure-access` edge function (fixes 100% loading — highest priority)
2. **Step 2**: Rewrite EbookReader for responsive + scroll mode + TOC
3. **Step 3**: Upgrade EbookCatalog with filters/sort/pagination
4. **Step 4**: Upgrade EbookDetail with preview + reviews + related
5. **Step 5**: Upgrade AdminEbooks with MediaUploader + bulk actions
6. **Step 6**: Add ProfileCompletenessWidget to dashboard

Total: 1 new file, 6 edited files. ~6 implementation steps.

