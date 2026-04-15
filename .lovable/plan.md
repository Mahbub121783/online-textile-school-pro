

# Sponsor System — Homepage Section + Admin Management

## Overview
Add a dynamic "Our Sponsors & Partners" section on the homepage and a full admin management page for sponsors. Sponsors will have tiers (Platinum/Gold/Silver/Bronze), click-through URLs, animated marquee/carousel display, and rich admin CRUD with drag-and-drop ordering.

## Database Migration

### Table: `sponsors`
```sql
CREATE TABLE sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text NOT NULL,
  website_url text,
  tier text DEFAULT 'silver' CHECK (tier IN ('platinum','gold','silver','bronze')),
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  click_count integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
-- Public read active sponsors
CREATE POLICY "Public read active sponsors" ON sponsors FOR SELECT USING (is_active = true);
-- Admin full access
CREATE POLICY "Admin manage sponsors" ON sponsors FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin'))
);
```

## New Files

### 1. `src/components/features/home/SponsorsSection.tsx`
- Fetches active sponsors from DB, grouped by tier
- Tier headings with distinct styling (Platinum = largest logos, Bronze = smallest)
- Infinite scrolling marquee animation for logo rows
- Each logo links to `website_url` (opens new tab), increments `click_count` via RPC
- Hover effect: logo scales up, shows sponsor name tooltip
- Responsive grid fallback on mobile

### 2. `src/pages/admin/AdminSponsors.tsx`
- Full CRUD table with columns: Logo preview, Name, Tier (badge), Website, Active toggle, Click count, Actions
- Create/Edit dialog with:
  - Name (required), Website URL (validated), Description
  - Tier selector (Platinum/Gold/Silver/Bronze)
  - Logo upload via MediaPickerModal (Cloudinary)
  - Active toggle, Sort order
- Delete confirmation
- Drag-and-drop reordering (sort_order)
- Click analytics display per sponsor
- Bulk toggle active/inactive

## Modified Files

### 3. `src/pages/Index.tsx`
- Add lazy-loaded `SponsorsSection` between `TestimonialsSection` and `DemoClassCTA`

### 4. `src/components/layout/AdminSidebar.tsx`
- Add `{ title: 'Sponsors', url: '/admin/sponsors', icon: Crown }` to `bottomItems` array

### 5. `src/App.tsx`
- Add route: `/admin/sponsors` → `AdminSponsors`

## Key Design Decisions
- Marquee animation via CSS `@keyframes` (no extra library)
- Click tracking: direct Supabase update `click_count = click_count + 1` on logo click
- Tier-based sizing: Platinum 120px height, Gold 96px, Silver 72px, Bronze 56px
- Admin follows existing dialog pattern (max-h-[90vh], overflow-y-auto, MediaPickerModal)

