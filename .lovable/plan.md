

The user wants the OG image for link previews to ALWAYS use the actual featured/cover/final image of the specific course, workshop, ebook, etc. — never fall back to the generic default when a real image exists.

Looking at the existing `og-meta` edge function, it already does this correctly for most sections (uses `og_image_url` → `thumbnail_url` → default). But I should verify:

1. **Courses**: uses `og_image_url || thumbnail_url || DEFAULT_IMAGE` ✓
2. **Workshops**: uses `banner_url || thumbnail_url || DEFAULT_IMAGE` ✓
3. **Ebooks**: uses `cover_url || DEFAULT_IMAGE` ✓
4. **Research**: uses `DEFAULT_IMAGE` only — needs `cover_image_url` or similar field check
5. **Internships**: uses `DEFAULT_IMAGE` only — needs banner/thumbnail check
6. **Posts/Blog**: uses `featured_image_url || DEFAULT_IMAGE` ✓

Also need to verify:
- The client-side `SEOHead` is being passed the right image on every detail page (CourseDetail, EbookDetail, BlogPost, etc.)
- Image URLs are absolute (https://...) — relative URLs break OG previews
- Image dimensions added (width/height meta) for each entry

# Plan: Always Use Actual Featured Image for Link Previews

## What's Wrong Now
The `og-meta` edge function already prioritizes featured images for most types, but:
1. **Research papers & Internships** fall back to default image (no banner/cover field queried)
2. **Some client pages** (CourseDetail, EbookDetail, BlogPost) may not pass `ogImage` to `SEOHead`
3. **Image URLs may be relative** (e.g., `/uploads/x.jpg`) — crawlers reject these
4. **No image dimensions** sent per entry — some platforms (LinkedIn, Telegram) skip images without size hints

## Changes

### 1. Edge Function (`supabase/functions/og-meta/index.ts`)
- Query banner/cover fields for **research_papers** (`cover_image_url`, `thumbnail_url`)
- Query banner/cover fields for **internships** (`banner_url`, `thumbnail_url`, `company_logo_url`)
- Add a `normalizeImageUrl()` helper: convert relative URLs to absolute, validate http(s) prefix, fall back to default only if truly empty
- Add `og:image:width` / `og:image:height` only when known (Cloudinary URLs we can leave as 1200x630 default since they're transformed)
- For Cloudinary images, append `/c_fill,w_1200,h_630/` transformation to guarantee 1200x630 output (perfect for WhatsApp/Facebook)

### 2. Client `SEOHead` Usage Audit
Pass real featured/cover image to `SEOHead` on:
- `CourseDetail.tsx` — `course.og_image_url || course.thumbnail_url`
- `EbookDetail.tsx` — `ebook.cover_url`
- `BlogPost.tsx` — `post.featured_image_url`
- `LearningPathDetail.tsx` — `path.thumbnail_url`
- (Already done: WorkshopDetail, InternshipDetail, ResearchPaperDetail)

### 3. Database Check (Read-only inspection first)
Verify the actual column names on `research_papers` and `internships` tables for image fields before querying them in the edge function.

## Files Changed
| File | Change |
|------|--------|
| `supabase/functions/og-meta/index.ts` | Query image fields for research/internships, add Cloudinary transform, add `normalizeImageUrl` helper |
| `src/pages/courses/CourseDetail.tsx` | Pass `ogImage` from course thumbnail |
| `src/pages/ebooks/EbookDetail.tsx` | Pass `ogImage` from ebook cover |
| `src/pages/cms/BlogPost.tsx` | Pass `ogImage` from post featured_image |
| `src/pages/courses/LearningPathDetail.tsx` | Pass `ogImage` from path thumbnail |

## How It Will Work After
```text
User shares: /courses/spinning-fundamentals
→ WhatsApp bot → .htaccess → og-meta function
→ Queries: courses.og_image_url || thumbnail_url
→ If Cloudinary URL: transforms to /c_fill,w_1200,h_630/
→ If relative URL: prepends https://onlinetextileschool.com
→ Returns OG tags with the actual course thumbnail
→ WhatsApp displays course image perfectly
```

The default `og-default.png` is now ONLY used for the homepage and pages with no associated content image.

