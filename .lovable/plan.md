

## Plan: Universal Registration System

### Overview

Build a complete public registration system with no login required. Two main parts: a public-facing registration form page and a full admin management section with form builder, page customization, submissions viewer, and Excel export.

### Database Schema (1 migration)

**Table: `registration_purposes`**
- `id` uuid PK
- `name` text NOT NULL (e.g. "Student", "Business", "Job")
- `slug` text UNIQUE NOT NULL
- `is_active` boolean DEFAULT true
- `max_entries` integer nullable
- `photo_required` boolean DEFAULT false
- `starts_at` timestamptz nullable
- `ends_at` timestamptz nullable
- `sort_order` integer DEFAULT 0
- `custom_fields` jsonb DEFAULT '[]' — array of `{key, label, type, required, options[]}`
- `created_at` timestamptz DEFAULT now()

**Table: `registration_form_config`** (singleton settings row)
- `id` uuid PK DEFAULT gen_random_uuid()
- `fields_order` jsonb DEFAULT '[]' — ordered list of base field keys
- `page_title` text DEFAULT 'Register'
- `page_subtitle` text nullable
- `banner_url` text nullable
- `event_details` text nullable
- `countdown_target` timestamptz nullable
- `custom_css` text nullable
- `updated_at` timestamptz DEFAULT now()

**Table: `registrations`**
- `id` uuid PK
- `purpose_id` uuid FK -> registration_purposes
- `full_name` text NOT NULL
- `email` text NOT NULL
- `mobile` text NOT NULL
- `blood_group` text nullable
- `university` text nullable
- `batch` text nullable
- `business_name` text nullable
- `job_area` text nullable
- `experience_years` integer nullable
- `photo_url` text nullable
- `extra_fields` jsonb DEFAULT '{}'
- `created_at` timestamptz DEFAULT now()

RLS: Public INSERT (no auth needed). Admin SELECT/UPDATE/DELETE.

### Frontend — Public Registration Page

**New file: `src/pages/registration/PublicRegistration.tsx`**
- Route: `/register/:slug?` (optional slug filters to a specific purpose)
- No login required
- Top: countdown timer (fetched from `registration_form_config.countdown_target`), banner image, title/subtitle
- Form fields rendered dynamically based on `registration_form_config.fields_order` and selected purpose
- **Registration Purpose** dropdown: fetches active purposes where `now()` is between `starts_at`/`ends_at` and entry count < `max_entries`
- Conditional fields: when purpose changes, show/hide Business Name, Job Area, Experience Years based on purpose slug
- University field: combo-box that queries distinct universities from existing `registrations` for auto-suggestions
- Photo upload: uses existing `useFileUpload` hook (Cloudinary for images)
- On submit: inserts into `registrations` table via Supabase anon client (RLS allows public insert)
- Success: animated confirmation card with registration number

### Admin Dashboard — Universal Registration Menu

**New file: `src/pages/admin/AdminRegistrations.tsx`** with 3 tabs:

**Tab A: Form Settings**
- Purpose management: CRUD table for `registration_purposes` — name, slug, active toggle, max entries, date range, photo required, custom fields
- Custom fields per purpose: inline editor to add `{label, type: text|select|number|date, required, options}`
- Base field ordering: drag-and-drop list of the standard fields (name, email, mobile, blood group, university, batch)
- Validation toggles: mark each base field as optional/compulsory per purpose

**Tab B: Page Customization**
- Edit `registration_form_config` singleton: page title, subtitle, countdown target (datetime picker), banner image (MediaPickerModal), event details (rich text)

**Tab C: Submissions**
- Purpose filter dropdown + search bar
- Stats cards: total registrations, per-purpose counts
- Data table with all submissions, sortable/filterable
- Click row to open detail modal with all fields + photo
- Export button: generates Excel file for filtered or all data using a client-side XLSX library (SheetJS)

### Routing & Sidebar

- Add `/register` and `/register/:slug` routes in `App.tsx` (public, outside admin layout)
- Add `AdminRegistrations` lazy import and route `/admin/registrations` inside admin layout
- Add "Registration" menu item in `AdminSidebar.tsx` with `ClipboardList` icon in the bottom items section

### File Summary

| File | Action |
|------|--------|
| Migration | Create `registration_purposes`, `registration_form_config`, `registrations` tables with RLS |
| `src/pages/registration/PublicRegistration.tsx` | New — public form with countdown, conditional fields, photo upload |
| `src/pages/admin/AdminRegistrations.tsx` | New — 3-tab admin management (settings, page customization, submissions + export) |
| `src/App.tsx` | Add routes for `/register`, `/register/:slug`, `/admin/registrations` |
| `src/components/layout/AdminSidebar.tsx` | Add Registration menu item |

4 new/modified files + 1 migration.

