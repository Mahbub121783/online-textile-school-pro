

# Certificate System — Deep Audit & Fixes

## Issues Found

### 1. "Verify" Button is Non-Functional (Student Page)
`CertificatesPage.tsx` line 254-256: The "Verify" button renders but has no `onClick` handler — it does absolutely nothing. There's no public verification page for certificate numbers.

**Fix**: Create a public `/verify-certificate` page where anyone can enter a certificate number and see the student name, course, and issue date. Link the Verify button to it.

### 2. `as any` Type Casts Are Unnecessary
`cert_template_id` exists in the Supabase types (`string | null`). All `as any` casts in `AdminCertificates.tsx` (lines 183, 188, 202), `CourseSettingsTab.tsx` (line 92), and `CourseBuilder.tsx` (line 82) are unnecessary and reduce type safety.

**Fix**: Remove all `as any` casts for `cert_template_id` updates.

### 3. No Admin Manual Certificate Issuance
Admins cannot manually issue a certificate to a student. The only path is auto-issuance at 100% progress. If a student has an edge case (transferred credit, admin override), there's no way to issue.

**Fix**: Add a "Manual Issue" button in the Issued Certificates tab with a student/course picker dialog.

### 4. No Admin Certificate Revocation
Once issued, a certificate cannot be revoked by an admin. If issued in error or for a refunded student, it remains forever.

**Fix**: Add a "Revoke" action on each issued certificate row that deletes the record and notifies the student.

### 5. No Email Sent on Auto-Issuance
The `autoIssueCertificate` function creates an in-app notification but does NOT send the `certificate_issued` email template (which already exists in the SMTP system).

**Fix**: After inserting the certificate, invoke `send-smtp-email` with the `certificate_issued` template.

### 6. `downloaded_at` / `download_count` Update Uses `as any`
`CertificatesPage.tsx` line 139-142 casts the update payload. These columns exist in the DB but may not be in the generated types. This works but is a type gap.

**Fix**: Remove `as any` or keep as-is (minor).

### 7. Instructor Signature Not Populated in Student Download
`CertificatesPage.tsx` line 136 sets `instructor_signature: ''` — always empty. Should fetch the course instructor's name.

**Fix**: Join `courses` with `user_profiles` via `instructor_id` to get the instructor name.

### 8. No Bulk Certificate Operations in Admin
No way to bulk-issue or bulk-revoke certificates for an entire course cohort.

**Fix**: Add a "Bulk Issue" action for a selected course that generates certificates for all eligible students who don't have one yet.

## Implementation Plan

### Step 1: Fix Type Safety — Remove `as any` Casts
**Files**: `AdminCertificates.tsx`, `CourseSettingsTab.tsx`, `CourseBuilder.tsx`
- Remove unnecessary `as any` on `cert_template_id` updates (it's already in the types)

### Step 2: Create Public Certificate Verification Page
**New file**: `src/pages/verify/VerifyCertificate.tsx`
- Input field for certificate number
- Queries `certificates` joined with `user_profiles` and `courses`
- Shows student name, course title, issue date, score (if any)
- Add route `/verify-certificate` to `App.tsx`
- Wire the "Verify" button on student certificates page to open this URL

### Step 3: Add Instructor Signature to Student Downloads
**File**: `CertificatesPage.tsx`
- Modify the courses query to join `user_profiles` via `instructor_id`
- Pass instructor's `full_name` as `instructor_signature` in `CertificateData`

### Step 4: Add Email Notification on Auto-Issuance
**File**: `src/hooks/useEnrollments.ts`
- After certificate INSERT, fetch the user's email and invoke `send-smtp-email` edge function with the `certificate_issued` template

### Step 5: Admin Manual Issue & Revoke
**File**: `src/pages/admin/AdminCertificates.tsx`
- Add "Manual Issue" button → dialog with student search + course select → issues certificate
- Add "Revoke" dropdown action on each issued certificate row → deletes certificate + notifies student
- Add "Bulk Issue" button → selects a course → issues to all eligible students without existing certs

## Files Modified
1. `src/pages/admin/AdminCertificates.tsx` — Remove `as any`, add manual issue/revoke/bulk
2. `src/pages/admin/course-management/CourseSettingsTab.tsx` — Remove `as any`
3. `src/pages/instructor/CourseBuilder.tsx` — Remove `as any`
4. `src/pages/dashboard/CertificatesPage.tsx` — Wire Verify button, add instructor signature
5. `src/hooks/useEnrollments.ts` — Add email on auto-issuance
6. `src/pages/verify/VerifyCertificate.tsx` — New public verification page
7. `src/App.tsx` — Add `/verify-certificate` route

No database migrations needed — all tables and columns already exist.

