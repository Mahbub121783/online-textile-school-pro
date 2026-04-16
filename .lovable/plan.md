
The user wants a fully dynamic, admin-managed popup system with multiple types (event, countdown, registration, newsletter, promo, custom HTML, image, video), targeting rules, scheduling, and analytics. Let me design this.

# Advanced Dynamic Popup System

## Overview
Build an admin-managed popup engine where admins create unlimited popups with rich customization (type, design, triggers, targeting, scheduling) and the frontend dynamically renders them based on real-time rules.

## Database Schema

### `popups` table
- `id`, `name` (admin label), `is_active`
- `type`: enum — `newsletter` | `registration` | `event` | `countdown` | `promo` | `image` | `video` | `custom_html` | `announcement`
- `title`, `subtitle`, `body_content` (rich text/HTML)
- `image_url`, `video_url`, `background_color`, `text_color`, `accent_color`
- `cta_primary_label`, `cta_primary_url`, `cta_secondary_label`, `cta_secondary_url`
- `layout`: `center_modal` | `slide_in_bottom_right` | `slide_in_bottom_left` | `top_banner` | `bottom_banner` | `fullscreen`
- `size`: `sm` | `md` | `lg` | `xl`
- `animation`: `fade` | `zoom` | `slide` | `bounce`
- **Trigger rules**: `trigger_type` (`on_load` | `delay` | `scroll_percent` | `exit_intent` | `time_on_page`), `trigger_value` (number)
- **Targeting**: `target_pages` (array of path patterns, e.g. `["/", "/courses/*"]`), `exclude_pages`, `target_devices` (`all` | `mobile` | `desktop`), `target_user_state` (`all` | `guest` | `logged_in`)
- **Frequency**: `frequency` (`once` | `every_visit` | `every_n_days`), `frequency_value`
- **Scheduling**: `start_date`, `end_date`
- **Countdown**: `countdown_target_date` (for countdown type)
- **Form fields**: `form_fields` JSONB (for registration/newsletter — array of `{name, label, type, required}`)
- `priority` (int, higher shows first if multiple match)
- `created_by`, `created_at`, `updated_at`

### `popup_submissions` table
Stores form submissions from registration/newsletter popups.
- `id`, `popup_id`, `user_id` (nullable), `form_data` JSONB, `email`, `submitted_at`, `ip_address`

### `popup_analytics` table
- `id`, `popup_id`, `event_type` (`view` | `click_primary` | `click_secondary` | `dismiss` | `submit`), `user_id` (nullable), `session_id`, `page_path`, `created_at`

## Frontend Architecture

### `usePopupEngine()` hook (global, in App.tsx)
- Fetches active popups for current route on mount + route change
- Evaluates trigger conditions (delay timers, scroll listeners, exit intent, idle time)
- Checks frequency cap via localStorage (`popup_seen_<id>` with timestamp)
- Picks highest-priority eligible popup
- Renders via portal

### `<PopupRenderer>` component
- Switches on `type` to render appropriate variant
- Components per type:
  - `NewsletterPopup` — email capture
  - `RegistrationPopup` — multi-field form
  - `EventPopup` — event details + RSVP
  - `CountdownPopup` — uses existing `CountdownTimer`
  - `PromoPopup` — discount code reveal
  - `ImagePopup`, `VideoPopup`, `CustomHtmlPopup`, `AnnouncementPopup`
- Layout wrapper handles position (modal/slide-in/banner/fullscreen) and animation

### Tracking
- Fires `view` analytics on render, `click`/`dismiss`/`submit` on interaction
- Uses `supabase.from('popup_analytics').insert(...)`

## Admin Management UI

### `/admin/popups` (List page)
- Table: name, type, status toggle, views, conversions, schedule, actions
- "Create Popup" button → opens builder

### `<PopupBuilder>` modal/page (advanced 4-tab interface)
1. **Content** — type selector, title/body (rich text), images/video, CTAs, form field builder
2. **Design** — layout, size, colors (with picker), animation, live preview pane
3. **Behavior** — trigger type + value, frequency, scheduling, countdown date
4. **Targeting** — pages (multi-input with wildcards), devices, user state, priority

### `/admin/popups/:id/analytics`
- Stats: total views, click-through rate, conversion rate, dismiss rate
- Submissions table with CSV export
- Time-series chart (Recharts)

### Admin sidebar
Add "Popups" entry under **Engagement** category.

## Files Created

| File | Purpose |
|------|---------|
| `src/hooks/usePopupEngine.tsx` | Core engine: fetch, evaluate triggers, render |
| `src/components/popups/PopupRenderer.tsx` | Type dispatcher + layout wrapper |
| `src/components/popups/variants/NewsletterPopup.tsx` | Newsletter variant |
| `src/components/popups/variants/RegistrationPopup.tsx` | Registration form variant |
| `src/components/popups/variants/EventPopup.tsx` | Event variant |
| `src/components/popups/variants/CountdownPopup.tsx` | Countdown variant |
| `src/components/popups/variants/PromoPopup.tsx` | Promo/discount variant |
| `src/components/popups/variants/ImagePopup.tsx` | Image variant |
| `src/components/popups/variants/VideoPopup.tsx` | Video variant |
| `src/components/popups/variants/CustomHtmlPopup.tsx` | Custom HTML variant |
| `src/components/popups/variants/AnnouncementPopup.tsx` | Announcement banner |
| `src/components/popups/PopupLayout.tsx` | Position + animation wrapper |
| `src/pages/admin/AdminPopups.tsx` | List page |
| `src/pages/admin/popups/PopupBuilder.tsx` | 4-tab builder |
| `src/pages/admin/popups/PopupAnalytics.tsx` | Analytics page |
| `src/components/admin/popup-builder/ContentTab.tsx` | Builder content tab |
| `src/components/admin/popup-builder/DesignTab.tsx` | Builder design tab + preview |
| `src/components/admin/popup-builder/BehaviorTab.tsx` | Builder behavior tab |
| `src/components/admin/popup-builder/TargetingTab.tsx` | Builder targeting tab |
| `src/components/admin/popup-builder/FormFieldBuilder.tsx` | Drag-and-drop form field builder |

## Files Modified
| File | Change |
|------|--------|
| `src/App.tsx` | Mount `<PopupEngine />` globally + add admin routes |
| `src/components/layout/AdminSidebar.tsx` | Add "Popups" link under Engagement |

## Database Migrations
1. Create `popups` table with all fields above
2. Create `popup_submissions` table
3. Create `popup_analytics` table
4. RLS: public can SELECT active popups, admins manage all, anyone can INSERT analytics/submissions, only admins/owner can SELECT submissions

## Key Behaviors
- Frequency caps stored client-side (localStorage) + server-side check via `popup_analytics`
- Path matching supports `*` wildcards (e.g., `/courses/*`)
- Exit intent uses `mouseleave` on `document.documentElement` toward top
- Scroll triggers use throttled scroll listener
- Priority resolves conflicts when multiple popups match same page
- All popups respect cookie consent (skip if `functional` not allowed for non-essential popups)
