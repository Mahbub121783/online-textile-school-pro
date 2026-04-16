

## SEO Audit — Current State

**Strong foundations already in place:**
- `SEOHead` (title, description, canonical, OG/Twitter, JSON-LD, breadcrumbs) used on 30 public pages including CourseDetail, EbookDetail, Blog, Faculty, Departments, Workshops, Research, Internships, DynamicPage
- `og-meta` edge function serves perfect crawler HTML for courses/ebooks/workshops/research/internships/learning-paths/blog (proxied via `.htaccess` for FB/WhatsApp/Twitter/LinkedIn/Google bots)
- Dynamic XML sitemap edge function with all entity slugs + priorities + lastmod
- `robots.txt` with sitemap reference, blocks admin/dashboard/instructor
- `EducationalOrganization` + `WebSite SearchAction` + `Course` + `Book` + `BreadcrumbList` JSON-LD
- Auto slug generation triggers on courses/ebooks/workshops via `generate_seo_slug`
- AI index builder for internal search

**Gaps that block "100% auto high-SEO on upload":**

| # | Gap | Fix |
|---|---|---|
| 1 | `og-meta` ebook query missing `meta_title`/`meta_description`/`og_image_url`/`seo_keywords` | Use SEO fields when present, fallback to defaults |
| 2 | Workshops/Learning paths/Posts in `og-meta` ignore meta_title/meta_description fields | Read them from DB, fallback to title/description |
| 3 | Course/Ebook creators may leave SEO fields empty → weak titles/descriptions | DB trigger auto-fills `meta_title`, `meta_description`, `seo_keywords` from title + short_description on insert/update if blank |
| 4 | No image alt text guidance + no `<h1>` audit on listing pages | Already OK — `h1` exists in detail pages |
| 5 | Sitemap not pinged to Google/Bing on publish | Add `pg_net` trigger: when course/ebook/post is_published=true → POST sitemap URL to Google + Bing ping endpoints |
| 6 | Sitemap missing: workshops, research_papers, internships, faculty | Add these sections to sitemap function |
| 7 | No `hreflang` for English/Bengali bilingual content | Add `<link rel="alternate" hreflang="en|bn">` in `SEOHead` |
| 8 | AdminCourses page is a 46-line stub — no edit form (instructor CourseBuilder has SEO fields, but admins can't edit course SEO directly) | Out of scope for SEO; instructor builder already covers it |
| 9 | EbookReader & forum CreatePost lack SEOHead (low priority — auth-gated/transient) | Add lightweight SEOHead with `noindex` |
| 10 | No `Article` JSON-LD on blog posts (only basic OG) | Add `Article`/`BlogPosting` JSON-LD in `BlogPost.tsx` |
| 11 | No FAQ schema on Course detail | Optional — add `FAQPage` JSON-LD when course has Q&A |
| 12 | After publish, sitemap edge function isn't auto-pinged → Google waits days to recrawl | See #5 |

## Plan: Make Every New Course/Ebook Auto-SEO

### 1. Database trigger — auto-fill SEO fields on insert/update
For `courses`, `ebooks`, `workshops`, `posts`, `learning_paths`, `research_papers`:
- If `meta_title` blank → `title` (truncated 60 chars)
- If `meta_description` blank → `short_description` / `excerpt` / first 155 chars of `description`
- If `seo_keywords` blank (where column exists) → derive from title words + category + type ("textile", "online", "course"/"ebook")
- If `og_image_url` blank → use `thumbnail_url` / `cover_url` / `featured_image_url`

### 2. Auto-ping search engines on publish
New trigger via `pg_net`: when `is_published` flips to true (or `status='published'`), HTTP GET to:
- `https://www.google.com/ping?sitemap=<sitemap-url>`
- `https://www.bing.com/ping?sitemap=<sitemap-url>`
Plus `IndexNow` POST (free instant indexing for Bing/Yandex) — admin sets API key once in settings.

### 3. Expand `og-meta` edge function
- Read `meta_title`/`meta_description`/`og_image_url` for ebooks, workshops, learning_paths, posts (already done for courses)
- Fall back gracefully

### 4. Expand sitemap edge function
- Add `workshops`, `research_papers`, `internships`, `faculty` sections
- Add `<image:image>` namespace with thumbnails for richer image-search results
- Add news/article tags for blog posts

### 5. Bilingual hreflang in `SEOHead`
- Add `<link rel="alternate" hreflang="en" href="...">` and `<link rel="alternate" hreflang="bn" href="...?lang=bn">` + `x-default`

### 6. `BlogPost` JSON-LD
- Add `Article`/`BlogPosting` schema with author, datePublished, dateModified, image, publisher

### 7. New IndexNow edge function
- `indexnow-ping` accepts URL list, posts to `api.indexnow.org` — called by trigger #2

### 8. Admin SEO Dashboard (small new tab in Admin Settings)
- Read-only widget showing: total indexed pages, last sitemap ping, IndexNow key status, schema-validation tips
- "Re-index all" button (calls existing `ai-index-builder` + sitemap ping)

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/...sql` (new) | Auto-SEO fill triggers on 6 tables; IndexNow API key column on `settings`; pg_net publish-ping trigger |
| `supabase/functions/og-meta/index.ts` | Use meta_title/meta_description/og_image_url for all entity types |
| `supabase/functions/sitemap/index.ts` | Add workshops/research/internships/faculty + image:image namespace |
| `supabase/functions/indexnow-ping/index.ts` (new) | Push URLs to IndexNow on publish |
| `src/components/SEOHead.tsx` | Add hreflang en/bn/x-default tags |
| `src/pages/cms/BlogPost.tsx` | Add Article/BlogPosting JSON-LD |
| `src/pages/admin/AdminSettings.tsx` | New "SEO" tab — IndexNow key, re-index button, ping status |
| `src/pages/ebooks/EbookReader.tsx`, `src/pages/forum/CreatePost.tsx` | Add `SEOHead` with `noindex` |

## Result After Implementation
- **Every new course/ebook/post is auto-SEO'd** the moment it's saved — no manual meta fields needed
- **Google/Bing notified within seconds** of publish via sitemap ping + IndexNow
- **Crawlers see perfect OG tags** for every entity type (already working for courses; extends to all)
- **Image search coverage** via `<image:image>` in sitemap
- **Bilingual SEO** via hreflang for English/Bengali audiences
- **Rich results eligibility**: Course, Book, Article, FAQPage, BreadcrumbList, EducationalOrganization, AggregateRating already in place

## What stays the same
- Existing manual SEO inputs in InstructorCourseBuilder, AdminEbooks, AdminPages still work (and override auto-fill)
- All current `SEOHead` usage continues unchanged
- No breaking changes to URLs, slugs, or routing

