## Goal

1. "Use my current location" button should reliably auto-fill District + Upazila for Bangladesh users.
2. Replace the "Campus" field with "Department" everywhere it appears (since University/Institution already covers the institution name).
3. Make sure Department is shown/editable in the admin Student Detail page and any other admin views, and in the student profile area.

---

## Part 1 — Deep fix for "Use my current location"

Current behavior uses Nominatim with `zoom=10` and a thin address fallback chain. In Bangladesh this often returns empty `state_district` / `county`, so District never auto-fills (matches the user's screenshot where Gazipur was selected manually but no auto-update happened).

Fix in `src/components/LocationCapture.tsx`:

- Increase `zoom` to `14` and add `accept-language=en` so we get a richer English address breakdown.
- Build a Bangladesh-aware mapping:
  - **District** ← first match of: `state_district`, `county`, `district`, `city_district`, then a normalized lookup against the existing `BD_DISTRICTS` list (strip "District", "Zila", trailing whitespace, case-insensitive). If still empty, fall back to `city`.
  - **Upazila** ← first match of: `subdistrict`, `suburb`, `town`, `municipality`, `village`, `city_district`, `neighbourhood`, `hamlet`.
- Normalize the district string so the `<Select>` value matches one of `BD_DISTRICTS` exactly (e.g. "Gazipur District" → "Gazipur"). This is the key reason the dropdown wasn't updating.
- If the browser denies permission or times out, surface a clearer toast with a "Try again" hint.
- Add a secondary fallback to BigDataCloud's free reverse geocoder when Nominatim returns no usable district (no key required, better Bangladesh coverage).

In `src/pages/dashboard/SettingsPage.tsx` `handleLocation`:
- Always overwrite `district` and `upazila` when a value is returned (not only when previously empty), so the user sees the change immediately.
- Trigger a visible re-render of the Select by writing the normalized value.

---

## Part 2 — Replace "Campus" with "Department"

### Database
Add a `department text` column to `public.user_profiles` and backfill it from the existing `campus` column for any existing rows. Keep `campus` in the DB for now (no destructive drop) but stop using it in the UI.

### Frontend label + field swap (Department instead of Campus)
- `src/pages/dashboard/SettingsPage.tsx` — rename the Campus field to **Department**, bind it to `form.department`, placeholder e.g. "e.g. Textile Engineering". Load/save `profile.department`.
- `src/hooks/useProfileCompleteness.ts` — replace the `campus` completeness item with `department`.
- `src/pages/admin/StudentDetail.tsx` — replace the "Campus" ProfileField with **Department** (`profile.department`), and also surface it in any summary/header where Campus appears.
- `src/pages/admin/AdminStudents.tsx` and `src/pages/admin/AdminUsers.tsx` — add a Department column / filter so admins can see and filter students by department (currently neither shows it).
- `src/pages/Profile.tsx` and `src/pages/contributor/ContributorProfile.tsx` — show Department under the University line on public profile cards.

### TypeScript types
Regenerate `src/integrations/supabase/types.ts` after the migration so `user_profiles.department` is typed.

### Admin "students" view consistency
The user noted "user students oikhaneo thik koro" — make sure the new Department field is wired into:
- AdminStudents list (column + optional filter dropdown)
- StudentDetail header + Academic section
- Any export / CSV download of students (if present in AdminStudents) — include Department.

---

## Out of scope

- We are NOT renaming/removing the existing faculty/internship `department` columns — those are already correct.
- We are NOT dropping the `campus` column in this pass (kept as a safety net; can be removed in a later cleanup migration once we confirm nothing else reads it).

---

## Files to change

- `src/components/LocationCapture.tsx` (rewrite reverse-geocode logic)
- `src/pages/dashboard/SettingsPage.tsx` (Department field + handleLocation overwrite)
- `src/hooks/useProfileCompleteness.ts`
- `src/pages/admin/StudentDetail.tsx`
- `src/pages/admin/AdminStudents.tsx`
- `src/pages/admin/AdminUsers.tsx`
- `src/pages/Profile.tsx`
- `src/pages/contributor/ContributorProfile.tsx`
- New migration: add `department` column to `user_profiles`, backfill from `campus`.
- `src/integrations/supabase/types.ts` (auto-regenerated after migration approval).
