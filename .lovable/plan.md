

# Popup System Upgrades — Media Picker, Video Background, Smart Countdowns

## What you're asking

1. **Image/Video URL inputs are bare text fields** — should use the project's unified Media Picker (and accept YouTube/Vimeo links naturally)
2. **Background video** — let YouTube/Vimeo links play as a muted, looping background behind the popup content
3. **Advanced countdown** — instead of typing a date manually, link the countdown to a real **Course launch date**, **Workshop start date**, or **Event registration deadline** so it stays in sync automatically

## 1. Replace URL text fields with Media Picker

**`src/pages/admin/popups/PopupBuilder.tsx`** — replace the two raw `<Input>` fields for `image_url` and `video_url` with the existing `MediaPickerModal` (used by Sponsors, Workshops, Posts, etc.). Adds a thumbnail preview + "Choose / Replace / Remove" buttons. Still allows pasting an external URL (YouTube, Vimeo, Cloudinary) for video.

## 2. Background video support

**Schema migration** — add to `popups` table:
- `background_video_url TEXT` — YouTube/Vimeo/MP4
- `background_video_overlay_opacity NUMERIC DEFAULT 0.5` — dark overlay so text stays readable

**`src/components/popups/PopupLayout.tsx`** — when `background_video_url` is set:
- Render a `<video autoplay muted loop playsinline>` for direct MP4
- Render a YouTube/Vimeo iframe with `autoplay=1&mute=1&loop=1&controls=0` for embeds
- Position absolute, `object-cover`, behind content (`z-0`)
- Apply dark overlay with configured opacity
- Force text color to white when active for legibility

**Builder Design tab** — new "Background Video" section with media picker + opacity slider + live preview.

## 3. Smart countdown linked to real entities

**Schema migration** — add to `popups` table:
- `countdown_source TEXT DEFAULT 'manual'` — `manual` | `course` | `workshop` | `event` | `registration`
- `countdown_source_id UUID` — id of the linked entity
- `countdown_source_field TEXT` — which date field to read (`start_date`, `registration_deadline`, `application_deadline`, etc.)

**Builder Behavior tab** — when type = `countdown`, show:

```text
Countdown source: [Manual date ▼ | Course | Workshop | Event | Registration]
  ├─ Manual    → existing datetime input
  ├─ Course    → searchable Select (all courses) → field: start_date / enrollment_end
  ├─ Workshop  → searchable Select (all workshops) → field: start_date / registration_deadline
  ├─ Event     → searchable Select → field: event_date
  └─ Registration → searchable Select (registration pages) → field: deadline
```

**`src/components/popups/PopupRenderer.tsx`** — `CountdownVariant` resolves the target date at render:
- If `countdown_source = 'manual'` → use `countdown_target_date` (current behavior)
- Otherwise → fetch the linked record once and read the configured field
- Cache via React Query for 5 min; if entity has no date, fallback to `countdown_target_date`

**Bonus**: when countdown reaches zero, optionally hide popup or show an "expired" message (new `countdown_expired_action` field: `hide | show_message`).

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/...sql` (new) | Add `background_video_url`, `background_video_overlay_opacity`, `countdown_source`, `countdown_source_id`, `countdown_source_field`, `countdown_expired_action` to `popups` |
| `src/pages/admin/popups/PopupBuilder.tsx` | Media Picker for image/video, background video section, smart countdown selector |
| `src/components/popups/PopupLayout.tsx` | Render background video layer + overlay |
| `src/components/popups/PopupRenderer.tsx` | Resolve countdown target from linked entity, expired-action handling |

## Notes
- All existing popups continue to work (new columns are nullable with safe defaults)
- Background video respects mobile data: only plays after popup is visible, pauses on close
- Media Picker already supports image + video filtering via the `accept` prop

