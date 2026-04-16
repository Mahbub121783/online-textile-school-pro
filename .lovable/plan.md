

# Fix Link Preview Images (OG Meta Tags)

## Root Cause

There are **two problems** preventing link previews from showing images:

### Problem 1: Missing `og:image` in Static HTML
The `index.html` has `og:title`, `og:description`, and `og:url` — but **no `og:image` tag at all**. Social media crawlers (WhatsApp, Facebook, Twitter, LinkedIn) only read the raw HTML — they do NOT execute JavaScript. Since `SEOHead.tsx` sets OG tags via `useEffect`, crawlers never see them.

### Problem 2: Pages Not Passing `ogImage` to SEOHead
Even if JS ran, many pages (WorkshopDetail, ResearchPaperDetail, EventsPage, etc.) don't pass `ogImage` to `<SEOHead>` despite having `thumbnail_url` available.

## Solution (Two Parts)

### Part 1: Add Default OG Image to index.html + Fix Missing `og:image` Dimensions
Add a static `og:image` tag in `index.html` pointing to a proper 1200x630 default OG image. Also add `og:image:width` and `og:image:height` tags (required by many platforms for reliable rendering).

This ensures every page has at least a branded fallback image in the raw HTML.

### Part 2: Create a Crawler-Friendly Meta Tag Edge Function
Build a Supabase edge function (`og-meta`) that:
1. Accepts a path like `/courses/some-slug` or `/workshops/vibe-coding-masterclass`
2. Queries Supabase for the page-specific title, description, and image
3. Returns a minimal HTML page with correct `og:title`, `og:description`, `og:image` meta tags

Then add `.htaccess` rewrite rules to detect crawler user agents (facebookexternalhit, WhatsApp, Twitterbot, LinkedInBot, TelegramBot) and proxy those requests to the edge function.

### Part 3: Pass `ogImage` on All Detail Pages
Add `ogImage` prop to `<SEOHead>` on WorkshopDetail, ResearchPaperDetail, and any other detail pages that have images but don't pass them.

## Files Changed

| File | Change |
|------|--------|
| `index.html` | Add `og:image`, `og:image:width`, `og:image:height` with default branded image |
| `public/og-default.png` | **New** — 1200x630 branded OG image (generated) |
| `supabase/functions/og-meta/index.ts` | **New** — edge function returning proper meta tags for crawler requests |
| `public/.htaccess` | Add `RewriteCond` for crawler user agents → proxy to edge function |
| `src/pages/static/WorkshopDetail.tsx` | Pass `ogImage={workshop.thumbnail_url}` to SEOHead |
| `src/pages/static/InternshipDetail.tsx` | Pass `ogImage` to SEOHead |
| `src/pages/research/ResearchPaperDetail.tsx` | Pass `ogImage` to SEOHead |
| `src/pages/static/EventsPage.tsx` | Pass `ogImage` to SEOHead if available |

## How the Crawler Proxy Works

```text
User shares: https://onlinetextileschool.com/workshops/vibe-coding-masterclass

WhatsApp bot request →
  .htaccess detects "WhatsApp" user agent →
  Rewrites to: https://<supabase>/functions/v1/og-meta?path=/workshops/vibe-coding-masterclass →
  Edge function queries workshops table by slug →
  Returns HTML with:
    <meta property="og:title" content="Vibe Coding Masterclass" />
    <meta property="og:image" content="https://res.cloudinary.com/.../workshop-banner.jpg" />
    <meta property="og:description" content="Unlock the power of AI coding..." />
```

This is the industry-standard approach for SPAs that need social media link previews without SSR.

