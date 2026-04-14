

# Advanced Research Journal & Publication System

## Current State
The research papers system is minimal: a single `research_papers` table with basic fields, a simple public listing page, and an admin approval table. No file upload integration, no PDF reader, no review workflow, no paid access, no instructor involvement, no student dashboard integration.

## What We Will Build

### Database Schema Changes (Migration)

**1. Extend `research_papers` table** with new columns:
- `status` enum: `draft`, `submitted`, `under_review`, `revision_requested`, `approved`, `rejected` (replaces boolean `is_approved`)
- `access_type`: `free`, `paid`, `enrolled_only`
- `price` (numeric, default 0)
- `doi` (text) -- Digital Object Identifier
- `volume`, `issue`, `page_range` (journal metadata)
- `reviewer_id` (uuid, references user_profiles) -- assigned reviewer
- `reviewer_feedback` (text)
- `revision_notes` (text) -- author's revision notes
- `cover_image_url` (text)
- `citation_count` (integer, default 0)
- `view_count` (integer, default 0)

**2. New table: `research_paper_reviews`** -- peer review tracking
- `id`, `paper_id`, `reviewer_id`, `status` (pending/completed), `rating` (1-5), `feedback`, `is_anonymous`, `created_at`

**3. New table: `research_paper_access`** -- tracks who purchased/has access
- `id`, `paper_id`, `user_id`, `access_type` (purchased/granted), `created_at`

**4. New table: `research_paper_bookmarks`** -- user bookmarks/library
- `id`, `paper_id`, `user_id`, `created_at`

### Frontend Pages & Components

**5. Research Paper Detail Page** (`/research/:paperId`)
- Full abstract, author info, metadata (DOI, volume, issue, date, citations, downloads)
- Access control: free papers show "Read" button; paid papers show price + "Purchase" button
- BibTeX/APA/MLA citation generator
- Related papers section
- Bookmark button for logged-in users

**6. Research Paper Reader** (`/research/:paperId/read`)
- Reuse the same PDF.js architecture as EbookReader
- Reading modes (light/dark/sepia), zoom, fit-to-width/page
- Page navigation, TOC extraction
- Text highlighting and note-taking (persisted per user)
- DRM protections (no copy, no print, watermark with user info)
- Access verification via `research_paper_access` or free status

**7. Enhanced Submit/Upload Flow** (students + instructors)
- Multi-step submission form: metadata -> co-authors -> file upload (using existing R2 upload hook) -> preview -> submit
- Real file upload via `useFileUpload` (R2 storage with `forceR2: true`)
- Co-author management (add multiple authors with affiliations)
- Draft saving -- users can save and come back

**8. Student Dashboard: My Research** (`/dashboard/my-research`)
- List of submitted papers with status badges (draft, submitted, under review, approved, rejected)
- Revision requests with reviewer feedback
- Resubmit capability
- Bookmarked papers library
- Download/citation stats for published papers

**9. Instructor Research Management** (`/instructor/research`)
- Papers submitted by their students
- Peer review assignments -- review papers assigned by admin
- Review interface: rating, feedback, approve/request revision/reject
- Instructor can also submit their own papers

**10. Enhanced Admin Panel** (`/admin/research-papers`)
- Full workflow management: assign reviewers, change status through pipeline
- Dashboard stats: total papers, pending reviews, published this month
- Assign peer reviewers (instructors/other users)
- Set access type (free/paid) and price
- Journal metadata management (volume, issue assignment)
- Bulk actions (approve, reject, delete)
- Revenue tracking for paid papers

**11. Public Research Catalog** (`/research`)
- Advanced search with filters: category, date range, author, access type
- Sort by: newest, most downloaded, most cited
- Category/department browsing
- Featured/trending papers section
- Pagination

### Integration Points
- **Upload system**: Uses existing `useFileUpload` with `forceR2: true` for PDF storage
- **Payment**: Paid papers go through existing cart/checkout flow (add to cart like courses/ebooks)
- **Notifications**: Admin notified on submission; author notified on status change
- **Navigation**: Add "My Research" to DashboardSidebar; add review section to InstructorSidebar

## Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Extend `research_papers`, create 3 new tables |
| `src/pages/static/ResearchPapersPage.tsx` | Complete rewrite -- advanced catalog |
| `src/pages/research/ResearchPaperDetail.tsx` | **New** -- paper detail page |
| `src/pages/research/ResearchPaperReader.tsx` | **New** -- PDF reader (based on EbookReader) |
| `src/pages/research/ResearchSubmit.tsx` | **New** -- multi-step submission form |
| `src/pages/dashboard/MyResearchPage.tsx` | **New** -- student research dashboard |
| `src/pages/instructor/InstructorResearch.tsx` | **New** -- instructor review & management |
| `src/pages/admin/AdminResearchPapers.tsx` | Full rewrite -- workflow dashboard |
| `src/components/layout/DashboardSidebar.tsx` | Add "My Research" nav item |
| `src/components/layout/InstructorSidebar.tsx` | Add "Research" nav item |
| `src/App.tsx` | Add new routes |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

