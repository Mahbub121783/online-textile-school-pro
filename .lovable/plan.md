

# Plan: SEO-Friendly Slugs + Homepage White Flash Fix

## Problem Summary
1. **Workshops use UUID in URL** — the `slug` column exists but is empty for some workshops, causing fallback to UUID
2. **Courses and ebooks** — already have slugs populated, but need to ensure auto-generation for new records
3. **Homepage white flash** — `HeroSlider` shows nothing until the DB query resolves on first load; fallback slides only kick in after the query completes

## Implementation

### 1. Database Migration: Auto-Slug Generation
Create a trigger function that auto-generates slugs on INSERT/UPDATE for `workshops`, `courses`, and `ebooks`:
- Convert title to lowercase, replace spaces/special chars with hyphens, strip non-alphanumeric
- Handle collisions by appending `-1`, `-2`, etc.
- **Backfill** all existing records with empty/null slugs (currently the workshop "vibe Coding Masterclass" has no slug)

```sql
-- Function: generate_slug(title, table, existing_id)
-- Trigger: on INSERT/UPDATE for workshops, courses, ebooks
-- Backfill: UPDATE workshops SET slug = ... WHERE slug IS NULL OR slug = ''
```

### 2. HeroSlider: Eliminate White Flash
The issue: `dbSlides` is `undefined` during the first render (query loading). The `useMemo` produces `FALLBACK_SLIDES` only when `dbSlides` is defined but empty. During initial load, `slides` defaults to fallback but the component still renders blank because React Query hasn't resolved yet.

**Fix**: Show the fallback slides immediately while loading by changing the query to use `placeholderData` or by defaulting `dbSlides` to `undefined` and ensuring `slides` always falls back:
- Set `placeholderData: []` on the query so `dbSlides` is `[]` (not `undefined`) from the very first render
- This makes `slides = FALLBACK_SLIDES` instantly, eliminating the white flash
- Once real data arrives, it seamlessly replaces the fallback

### 3. Navigation Links — Always Use Slug
Ensure `WorkshopsPage.tsx` navigation always uses slug (already does with fallback to id). After backfill, all records will have slugs.

## Files Changed
| File | Change |
|------|--------|
| **New migration SQL** | `generate_seo_slug()` function + triggers on 3 tables + backfill |
| `src/components/features/home/HeroSlider.tsx` | Add `placeholderData: []` to the query options |

## Technical Details
- The slug trigger fires `BEFORE INSERT OR UPDATE` and only acts when `slug IS NULL OR slug = ''`
- Collision loop: tries `base-slug`, then `base-slug-1`, `base-slug-2`, up to 100
- Backfill runs once in the migration for all existing null/empty slugs across all 3 tables

