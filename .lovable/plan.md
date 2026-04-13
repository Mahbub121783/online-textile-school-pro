

# Make All Pages Dynamic, Editable & Perfectly Connected

## Summary
The user wants the previously fixed type-safe pages to be fully connected to the system with smart navigation, and wants static pages (About, Contact, Departments, etc.) to become dynamic and admin-editable. Additionally, remaining `as any` table-name casts need cleanup since all tables exist in the generated types.

## Phase 1: Remove Remaining Table-Name `as any` Casts
The following tables exist in the Supabase types but are still cast with `as any`:
- **`pages`** — in `AdminPages.tsx`, `PageEditor.tsx`, `DynamicPage.tsx`
- **`posts`** — in `AdminPosts.tsx`, `BlogList.tsx`, `BlogPost.tsx`
- **`payment_gateways`** — in `PaymentSettingsTab.tsx`, `PaymentDashboardTab.tsx`

Remove all `from('table_name' as any)` and `as any` on insert/update payloads where the type system can infer them.

## Phase 2: Make Static Pages Admin-Editable via `site_settings` Table
Currently `AboutPage`, `ContactPage`, `DepartmentsPage` have hardcoded content. We will:

1. **Create a `site_content` table** (migration) to store editable page sections:
   - `id`, `page_key` (e.g. `about`, `contact`, `departments`), `section_key` (e.g. `hero_title`, `hero_description`, `stats`, `departments_list`), `content` (JSONB — flexible for text, arrays, objects), `updated_at`, `updated_by`
   - Unique constraint on `(page_key, section_key)`
   - RLS: Public SELECT, admin-only INSERT/UPDATE/DELETE

2. **Create `AdminSiteContent.tsx`** — a new admin page at `/admin/site-content` where admins can edit content for About, Contact, Departments pages via a tabbed interface with inline JSON/text editors.

3. **Refactor static pages** to query `site_content` with fallback to current hardcoded values (graceful degradation — pages work even if DB content is empty).

4. **Add admin sidebar entry** for "Site Content" under the existing navigation.

## Phase 3: Navigation Completeness
Ensure all pages are reachable from multiple entry points:

1. **Header nav** — already has: Home, Courses, Learning Paths, eBooks, Departments, Events, Blog, Forum, Registration, About. Add `Contact` and `Alumni` to the mobile menu and footer (already in footer).

2. **Homepage sections** — add a "Learning Paths" section link and "Events" preview section to the homepage `Index.tsx`.

3. **Admin sidebar** — add "Site Content" entry to `AdminSidebar.tsx` bottom items.

4. **Cross-linking** — Add "View all Learning Paths" CTA to `FeaturedCourses` section, and "Browse Events" card to the homepage.

## Phase 4: Homepage Dynamic Sections
Add two new homepage sections:
1. **Upcoming Events Preview** — shows next 3 upcoming events from the `events` table with "View All" link to `/events`
2. **Learning Paths Preview** — shows top 3 published learning paths with "Explore All" link to `/learning-paths`

## Technical Details

### Database Migration
```sql
CREATE TABLE public.site_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  section_key text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(page_key, section_key)
);
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
-- Public read
CREATE POLICY "Anyone can view site content" ON public.site_content FOR SELECT USING (true);
-- Admin write
CREATE POLICY "Admins manage site content" ON public.site_content FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));
```

### Files to Create
- `src/pages/admin/AdminSiteContent.tsx` — tabbed editor for About/Contact/Departments content
- `src/components/features/home/UpcomingEvents.tsx` — homepage events preview
- `src/components/features/home/LearningPathsPreview.tsx` — homepage learning paths preview
- `src/hooks/useSiteContent.ts` — reusable hook to fetch site_content by page_key

### Files to Edit
- `AdminPages.tsx`, `PageEditor.tsx`, `DynamicPage.tsx` — remove `as any` on `pages`
- `AdminPosts.tsx`, `BlogList.tsx`, `BlogPost.tsx` — remove `as any` on `posts`
- `PaymentSettingsTab.tsx`, `PaymentDashboardTab.tsx` — remove `as any` on `payment_gateways`
- `AboutPage.tsx`, `ContactPage.tsx`, `DepartmentsPage.tsx` — fetch from `site_content` with fallback
- `AdminSidebar.tsx` — add Site Content nav item
- `Index.tsx` — add UpcomingEvents and LearningPathsPreview sections
- `App.tsx` — add route for `/admin/site-content`

