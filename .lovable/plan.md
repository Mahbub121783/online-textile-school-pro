

## Plan: Advanced Hero Slides Management + Dynamic Frontend Hero Section

### Current Problems

1. **Frontend is hardcoded** — `HeroSlider.tsx` uses a static `SLIDES` array, completely ignoring the `hero_slides` database table
2. **No media picker** — Admin form uses a raw "Image URL" text input instead of the existing `MediaPickerModal`
3. **No drag-and-drop reorder** — Sort order is manual number input
4. **CTA links are plain text** — No searchable link picker for internal pages/courses
5. **No live preview** — Admin cannot see how the slide looks before saving
6. **Missing advanced fields** — No text alignment, overlay opacity, gradient direction, or text color customization
7. **No duplicate slide** — Common workflow missing

### Implementation

**1. Database migration — add advanced styling columns**

Add columns to `hero_slides`:
- `gradient_from` (text, default `'primary'`) — start gradient color
- `gradient_to` (text, default `'primary-dark'`) — end gradient color  
- `gradient_direction` (text, default `'br'`) — gradient angle (br, r, b, bl, etc.)
- `overlay_opacity` (integer, default `5`) — pattern overlay opacity 0-20%
- `text_alignment` (text, default `'left'`) — left/center/right
- `title_color` (text, nullable) — custom title color override
- `subtitle_color` (text, nullable) — custom subtitle color override

**2. Admin Hero Slides page rewrite (`AdminHeroSlides.tsx`)**

- **Media picker integration**: Replace raw URL input with a button that opens `MediaPickerModal` for hero banner image selection. Label it "Hero Banner Image"
- **Searchable CTA link picker**: Add a combo-box for CTA Link and Secondary Link that searches internal routes (`/courses`, `/ebooks`, `/auth/register`, etc.) plus all published courses and pages from the database. Free-text entry for external URLs
- **Drag-and-drop reorder**: Use HTML5 drag-and-drop on the slide cards to reorder. Auto-save sort_order on drop
- **Live preview panel**: Show a mini hero preview (16:9 aspect ratio) in the edit dialog that updates in real-time as admin changes title, subtitle, image, gradient, alignment
- **Duplicate slide button**: Clone icon on each card
- **Gradient customizer**: Dropdown for direction + color pickers for from/to colors (preset palette of theme colors)
- **Text alignment toggle**: Left / Center / Right buttons
- **Overlay opacity slider**: 0-20% range slider
- **Countdown target field**: Date-time picker (column already exists in DB)
- **Bulk actions**: Select multiple slides to activate/deactivate/delete

**3. Frontend HeroSlider rewrite (`HeroSlider.tsx`)**

- **Fetch from database**: Replace static `SLIDES` array with a `useQuery` call to `hero_slides` table, filtered by `is_active = true`, ordered by `sort_order`
- **Fallback**: If no DB slides exist, show the current hardcoded slides as defaults
- **Dynamic rendering**: Apply `image_url` as background image (with gradient overlay), use DB `cta_text`/`cta_link`/`secondary_cta_text`/`secondary_cta_link`
- **Apply styling fields**: gradient direction, text alignment, overlay opacity, custom colors
- **Background image support**: When `image_url` is set, render it as `background-image` with the gradient as an overlay on top
- **Countdown timer**: If `countdown_target` is set and in the future, show a live countdown badge on the slide
- **Smooth transitions**: CSS transitions between slides with fade + slight slide animation
- **Touch swipe**: Add touch event handlers for mobile swipe navigation

### Technical Details

**Searchable link picker** — Fetch routes from a static list + query `courses` and `pages` tables:
```typescript
const internalRoutes = [
  { label: 'Courses', value: '/courses' },
  { label: 'Ebooks', value: '/ebooks' },
  { label: 'Register', value: '/auth/register' },
  // ...
];
// + dynamic: courses.map(c => ({ label: c.title, value: `/courses/${c.id}` }))
// + dynamic: pages.map(p => ({ label: p.title, value: `/${p.slug}` }))
```

**Live preview** in edit dialog — a scaled-down 16:9 div rendering the same gradient/image/text as the frontend hero.

### File Summary

| File | Action |
|------|--------|
| Migration | Add `gradient_from`, `gradient_to`, `gradient_direction`, `overlay_opacity`, `text_alignment`, `title_color`, `subtitle_color` to `hero_slides` |
| `src/pages/admin/AdminHeroSlides.tsx` | Full rewrite — media picker, link search, drag reorder, live preview, gradient controls, bulk actions |
| `src/components/features/home/HeroSlider.tsx` | Rewrite — fetch from DB, dynamic styles, background images, countdown, touch swipe |

3 file changes + 1 migration.

