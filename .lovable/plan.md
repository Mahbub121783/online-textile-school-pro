

# Core Web Vitals Optimization Plan

## Problems Identified

### LCP (Largest Contentful Paint)
1. **Primary fonts (Sora, DM Sans) loaded via `preload as="style"` trick** — the browser doesn't start downloading actual font files until the CSS is parsed. No `font-display: swap` fallback inline.
2. **Certificate/decorative fonts loaded on every page** (JetBrains Mono, Great Vibes, Dancing Script, etc.) — 14 font families loaded globally even though they're only used in certificate rendering and blog pages.
3. **No inline critical CSS** — the entire Tailwind stylesheet must download before first paint.
4. **Hero slider images not preloaded** — the LCP element (hero background image) waits for JS to execute a Supabase query before the browser even knows about the image URL.

### CLS (Cumulative Layout Shift)
1. **Hero slider has no aspect-ratio or min-height on initial render** — uses `h-[60vh] md:h-[80vh]` which is fine, but the `SectionFallback` spinner shown by `LazySection` wrappers has no fixed height, causing content to shift as each section loads.
2. **UtilityBar hidden on mobile (`hidden md:block`)** — no reserved space mismatch, but Header itself has no fixed height, so content below can shift when fonts load.
3. **FeaturedCourses, EbookShowcase, etc.** — skeleton loading states exist but the outer section wrapper doesn't reserve a minimum height, causing a jump from spinner to content.
4. **Font swap not specified** — when Sora/DM Sans load late, text reflows and shifts layout.

## What Will Change

### 1. Font Loading Optimization (index.html)
- Add `&display=swap` to Google Fonts URLs (forces `font-display: swap`)
- Move decorative/certificate fonts to a separate lazy-loaded stylesheet that only loads after page is interactive
- Add `<link rel="preload">` for the actual Sora woff2 font file (the LCP text element) so the browser fetches it immediately

### 2. Critical CSS Inlining (index.html)
- Inline a minimal `<style>` block in `<head>` with: body background color, font-family fallback, and the hero section's gradient background color — so the page is not blank white during CSS load

### 3. Reserve Space for Lazy Sections (Index.tsx)
- Give `LazySection` a `min-h-[300px]` (or section-appropriate) to prevent CLS when sections load in
- Give `SectionFallback` a matching minimum height so the spinner doesn't collapse to zero

### 4. Hero Slider CLS Prevention (HeroSlider.tsx)
- The hero already has `h-[60vh] md:h-[80vh]` which is good
- Add `fetchpriority="high"` and `loading="eager"` to the hero image `<img>` tag so the browser prioritizes the LCP image
- Add a CSS `aspect-ratio` fallback for the hero container

### 5. Font-display and Fallback Stack (index.css)
- Add explicit `font-display: swap` via `@font-face` override for Sora and DM Sans
- Ensure the Tailwind `fontFamily` config includes proper system font fallbacks to minimize reflow

### 6. Image Optimization Hints
- Add `fetchpriority="high"` to the hero slider image (LCP candidate)
- Add `loading="lazy"` to all below-fold images (FeaturedCourses thumbnails, instructor photos, etc.) — verify these already have it

## Files Changed

| File | Change |
|------|--------|
| `index.html` | Preload primary font woff2, add `display=swap`, defer decorative fonts, inline critical CSS |
| `src/index.css` | Add `@font-face` `font-display: swap` overrides for Sora and DM Sans |
| `src/pages/Index.tsx` | Add `min-h` to `LazySection` and `SectionFallback` to reserve space |
| `src/components/features/home/HeroSlider.tsx` | Add `fetchpriority="high"` and `loading="eager"` to hero image |
| `src/components/features/home/FeaturedCourses.tsx` | Add `min-h` to section wrapper |
| `src/components/features/home/EbookShowcase.tsx` | Add `min-h` to section wrapper |
| `src/components/features/home/TestimonialsSection.tsx` | Add `min-h` to section wrapper |

