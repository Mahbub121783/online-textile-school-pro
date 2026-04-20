

## Scope

7 changes across navigation, signup, profile system, geolocation, and Cloudinary upload pipeline. Let me explore key files first to ground the plan.

## Investigation summary

- **Profile fields in DB** (`user_profiles`): has `full_name`, `phone`, `university`, `batch`, `district`, `division`, `country`, `occupation`, `current_job`, `company_name`, `business_type`, `professional_role`, `blood_group`, `date_of_birth`, `referral_code`, `roll_id`, `headline`, `bio`, `avatar_url`, `preferred_language`. Missing: `username`, `upazila`, `campus`, `name_last_changed_at`, `latitude`, `longitude`.
- **Settings form** (`SettingsPage.tsx`) is the user-facing editor.
- **Signup** at `src/pages/auth/Register.tsx`.
- **Header menu** at `src/components/layout/Header.tsx` (Udemy-style 2-row, per memory).
- **Cloudinary**: `useCloudinaryUpload` → `cloudinary-proxy` edge function. Currently sends file as base64 (no client compression in code), but uses default upload — we can pass `public_id` and `use_filename=false` to control naming. Need to verify proxy supports `public_id` param.

---

## Plan

### 1. Add "Registration" to main navigation
- Update `src/components/layout/Header.tsx` (desktop top row) and `src/components/layout/BottomNav.tsx` (mobile) to include a **Registration** link → `/register-event` (existing `PublicRegistration` page at route `/register/:slug` or similar — verify route in `App.tsx`; if a generic listing page exists, link there; otherwise add a small landing page listing open registration forms).

### 2. Name change restriction (once / 30 days)
- **DB migration**: add `name_last_changed_at timestamptz` to `user_profiles`.
- **DB trigger** `enforce_name_change_cooldown` on `user_profiles` BEFORE UPDATE: if `full_name` changed and `name_last_changed_at > now() - interval '30 days'`, raise exception. Set `name_last_changed_at = now()` when name changes.
- **UI** (`SettingsPage.tsx`): disable Full Name input when within cooldown; show "Next change available on {date}" helper text.

### 3. Unique usernames at signup
- **DB migration**: add `username citext UNIQUE` to `user_profiles` (use `citext` for case-insensitive uniqueness; enable extension if needed). Add CHECK for length 3–30 and `^[a-z0-9_]+$`.
- **Signup** (`Register.tsx`): add Username field with live availability check (debounced query against `user_profiles`).
- **`handle_new_user` trigger**: extend to read `username` from `raw_user_meta_data` and insert it.
- **Settings**: show username as read-only (or allow change with same 30-day rule — confirm with user; default = read-only after signup).

### 4. Expanded profile details
Add to `user_profiles` (migration): `campus text`, `upazila text`, `gender text`, `nid_number text`, `emergency_contact text`, `linkedin_url text`, `facebook_url text`, `github_url text`, `website_url text`, `latitude numeric`, `longitude numeric`, `location_updated_at timestamptz`.
Surface all in `SettingsPage.tsx` grouped: Personal / Education / Professional / Address / Social / Emergency.
Update `useProfileCompleteness` to weight new fields.

### 5. Geolocation ("Access Location")
- New component `LocationCapture.tsx` in Settings:
  - Button: "Use my current location" → `navigator.geolocation.getCurrentPosition` → store `latitude`, `longitude`, `location_updated_at`.
  - Reverse-geocode via free **Nominatim (OpenStreetMap)** API to auto-fill `district` + `upazila` + `country` (no API key needed). Allow manual override.
  - Manual edit always available for District / Upazila.

### 6. Remove Division, add Upazila
- Migration: keep `division` column (don't drop, for data safety) but **remove from UI everywhere**: `SettingsPage.tsx`, `StudentDetail.tsx` admin view, ID card, public profile.
- Replace with **Upazila** input (free text or dropdown — start with text input for simplicity).

### 7. Cloudinary: upload original quality + rename by user ID
- **Verify**: read `supabase/functions/cloudinary-proxy/index.ts` to confirm it forwards file as-is (no client compression in `useCloudinaryUpload` — it uses FileReader base64, which preserves bytes; fine).
- **Rename**: extend `useCloudinaryUpload.upload(file, opts?)` to accept `{ publicId?: string, folder?: string }`. Pass through to proxy body. Update `cloudinary-proxy` to forward `public_id`, `folder`, `overwrite=true`, `use_filename=false`, `unique_filename=false` to Cloudinary signed upload. Resource type stays auto.
- **Caller** (avatar upload in `SettingsPage.tsx` / `PublicProfileEditor.tsx`): pass `publicId: \`users/\${profile.id}/avatar\`` so every user's avatar overwrites the same Cloudinary object — easy tracking by user ID.
- **No quality loss**: ensure no client-side canvas resize / compression is invoked for avatars (audit `MediaUploader.tsx` and avatar pickers). Cloudinary's `f_auto,q_auto` delivery URL handles optimization at request time; original is preserved.

---

## Files to change

| File | Change |
|---|---|
| `supabase/migrations/<new>.sql` | Add `username` (citext unique), `name_last_changed_at`, `upazila`, `campus`, `gender`, `nid_number`, `emergency_contact`, social URLs, `latitude`, `longitude`, `location_updated_at` columns; cooldown trigger; update `handle_new_user` |
| `src/pages/auth/Register.tsx` | Username field + availability check |
| `src/pages/dashboard/SettingsPage.tsx` | All new fields, name lock UI, geolocation button, remove Division, add Upazila, Cloudinary avatar with `publicId` |
| `src/components/shared/PublicProfileEditor.tsx` | Same field updates where applicable |
| `src/components/LocationCapture.tsx` (new) | Geolocation + Nominatim reverse-geocode |
| `src/hooks/useCloudinaryUpload.ts` | Accept `{ publicId, folder }` options |
| `supabase/functions/cloudinary-proxy/index.ts` | Forward `public_id`, `overwrite`, `unique_filename=false` |
| `src/components/layout/Header.tsx`, `BottomNav.tsx` | Add Registration link |
| `src/hooks/useProfileCompleteness.ts` | Include new fields |
| `src/pages/admin/StudentDetail.tsx` | Show new fields, drop Division |
| `src/components/student/StudentIdCard.tsx` | Drop Division, show Upazila/Campus where relevant |

## Result

- Registration is reachable from the main menu.
- Users cannot rename themselves more than once per 30 days (enforced in DB).
- Each user has a unique, immutable-by-default username.
- Profile is comprehensive (personal, social, emergency, geo).
- One-click "Use my location" auto-fills district/upazila; manual edit still works.
- Division removed; Upazila added.
- Avatars upload at original quality; Cloudinary stores them at `users/<user_id>/avatar` for clean tracking.

