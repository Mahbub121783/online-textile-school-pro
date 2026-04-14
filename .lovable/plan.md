

# Integrate Grade System into Certificates

## What Changes

Add grade information (letter grade + grade point) to the certificate system so that when a certificate is generated/downloaded, it displays the student's earned grade based on their `score_percentage` and the configured `grade_configs` table.

## Plan

### 1. Extend CertificateData interface (`src/lib/certificateRenderer.ts`)
- Add `grade_letter` and `grade_point` fields to `CertificateData`
- Add cases for `grade_letter` and `grade_point` in `getFieldText()`

### 2. Add grade fields to default certificate template (`src/pages/admin/AdminCertificates.tsx`)
- Add two new default fields: "Grade" (e.g., "A+") and "Grade Point" (e.g., "4.00 / 4.00")
- Update `SAMPLE_DATA` to include sample grade values

### 3. Look up grade at download time (`src/pages/dashboard/CertificatesPage.tsx`)
- Fetch `grade_configs` once
- When building `CertificateData` for download, map the certificate's `score_percentage` to the matching letter grade and grade point from `grade_configs`
- Pass `grade_letter` and `grade_point` into the data object

### 4. Update instructor preview (`src/pages/instructor/InstructorCertificates.tsx`)
- Add sample grade values to the preview `sampleData`

## Files Modified
| File | Change |
|------|--------|
| `src/lib/certificateRenderer.ts` | Add `grade_letter`, `grade_point` to interface + `getFieldText` |
| `src/pages/admin/AdminCertificates.tsx` | Add grade fields to `DEFAULT_FIELDS` and `SAMPLE_DATA` |
| `src/pages/dashboard/CertificatesPage.tsx` | Fetch grade_configs, compute grade from score_percentage |
| `src/pages/instructor/InstructorCertificates.tsx` | Add grade to preview sample data |

No database changes required -- existing `grade_configs` table and `certificates.score_percentage` column already have all needed data.

