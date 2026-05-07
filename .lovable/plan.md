
# Workshop Certificate System

Currently certificates only work for courses (`certificates.course_id` is NOT NULL). Workshops have no certificate flow at all. This plan extends the existing course-certificate engine to workshops without breaking it.

## 1. Database changes (migration)

### `certificates` table — make it polymorphic
- Drop `NOT NULL` on `course_id`; drop unique `(user_id, course_id)`.
- Add `workshop_id uuid REFERENCES public.workshops(id) ON DELETE CASCADE`.
- Add CHECK: exactly one of `course_id` / `workshop_id` is set.
- Add unique partial indexes:
  - `(user_id, course_id)` where `course_id IS NOT NULL`
  - `(user_id, workshop_id)` where `workshop_id IS NOT NULL`

### `workshops` table — certificate config
- `cert_template_id uuid REFERENCES public.certificate_templates(id)` (nullable)
- `certificate_enabled boolean DEFAULT false`
- `certificate_min_attendance_pct int DEFAULT 0` (0 = no attendance requirement)
- `certificate_min_quiz_pct int DEFAULT 0` (0 = no quiz requirement)
- `certificate_auto_issue boolean DEFAULT true` (issue automatically when workshop completes)

### Issuing function (security definer)
`issue_workshop_certificate(_workshop_id uuid, _user_id uuid)`:
1. Verify workshop is `completed` and `certificate_enabled=true` and has a template.
2. Verify user has a `workshop_registrations` row.
3. If `certificate_min_attendance_pct > 0`, require `checked_in_at IS NOT NULL` (single-session) or attendance rows ≥ pct (multi-day uses existing `workshop_attendance` if present; otherwise treat check-in as 100%).
4. If `certificate_min_quiz_pct > 0`, look up best `workshop_quiz_attempts` percentage for this user's registration on any active quiz of the workshop and require ≥ threshold.
5. Insert into `certificates` with auto-generated number `WS-YYYY-XXXXXX`, snapshot template, score from quiz if available. ON CONFLICT do nothing.
6. Return certificate id.

### Auto-issue trigger
`AFTER UPDATE` on `workshops` when `status` transitions to `completed` and `certificate_enabled=true` and `certificate_auto_issue=true`: loop over confirmed registrations and call `issue_workshop_certificate` (best-effort, swallow individual failures).

Also extend the existing `auto_update_workshop_status()` cron-friendly function so transition to `completed` fires the trigger.

### RLS
- Existing `certificates` RLS already keys on `user_id`; keep. Add policy `WITH CHECK` covering both course_id and workshop_id paths for admins/instructors.
- Allow students to insert their own workshop cert via the SECURITY DEFINER function only (no direct insert).

## 2. Admin UI — `AdminWorkshops.tsx`

In the workshop create/edit form, add a **Certificate** section:
- Toggle: Enable certificate
- Select: Certificate template (dropdown of `certificate_templates`)
- Number: Min attendance % (0 = none)
- Number: Min quiz score % (0 = none)
- Toggle: Auto-issue when workshop completes
- Button: **Re-issue now** — calls an edge function or RPC `issue_workshop_certificate` for every registered user (admin only).

Show in the registrations table per workshop a column "Certificate" with status (Issued / Eligible / Locked) and a manual "Issue" button per row.

## 3. Student UI

### `MyWorkshopsPage.tsx`
For each registration card, after the workshop ends and a certificate exists, show a **Download Certificate** button. If eligible but not issued (rare race), show **Claim Certificate** that calls the RPC then downloads.

### `CertificatesPage.tsx` (dashboard)
Extend the page to list workshop certificates alongside course certs:
- New query: workshop registrations with `workshops(*, certificate_templates(*))`.
- Reuse `downloadCertificatePDF` with workshop-derived `CertificateData` (course_title := workshop title, instructor_signature := workshop instructor).
- Show pending workshops the same way (with missing requirements: attendance, quiz score).

### Workshop detail (`WorkshopDetail.tsx`)
For a logged-in registered user when workshop is completed, show a "Download your certificate" CTA in the existing registered card.

## 4. Renderer

`src/lib/certificateRenderer.ts` already handles arbitrary `CertificateData`. No code changes needed; just pass the workshop fields. Add a thin helper `buildWorkshopCertificateData(reg, workshop, profile, gradeConfigs)` next to the existing course one.

## 5. Verification

`/verify-certificate` already looks up by `certificate_number` from `certificates`; will work for workshop certs since they live in the same table. Update the page to display "Workshop: <title>" when `workshop_id` is set instead of "Course: …".

## 6. Notifications (small)

When a workshop certificate is issued, insert a `notifications` row for the user: "Your certificate for <workshop> is ready to download" linking to `/dashboard/certificates`.

## Result

- Admins assign a template + thresholds per workshop in one place.
- When a workshop flips to `completed` (manual or via `auto_update_workshop_status`), every eligible registered user automatically gets a certificate with a unique number.
- Students see and download a real PDF from My Workshops or My Certificates.
- Works for past, current, and upcoming workshops (existing completed ones can be processed via the admin "Re-issue now" button).
- No regression to course certificates — same table, same renderer, polymorphic via CHECK + partial unique indexes.
