

## Plan: Student ID Card System with Barcode, Validation & Admin Management

### Overview

A university-style ID card system where paid course enrollment triggers ID card generation with automatic expiry calculation (6 months per course), landscape design with barcode authentication, preview/download on student profile, and full admin management.

### Database Migration

**New table: `student_id_cards`**

| Column | Type | Details |
|--------|------|---------|
| id | uuid | PK |
| user_id | uuid | References user_profiles |
| card_number | text | Unique, auto-generated (e.g. OTS-ID-000123) |
| valid_from | timestamptz | Date of first paid enrollment |
| valid_until | timestamptz | Calculated: 6 months per paid course |
| is_active | boolean | Default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**New table: `id_card_settings`** (admin-configurable)

| Column | Type | Details |
|--------|------|---------|
| id | uuid | PK, single row |
| university_name | text | Default "Online Textile School" |
| location | text | Default "Dhaka, Bangladesh" |
| authority_name | text | Signer name |
| authority_position | text | Signer title |
| signature_url | text | Uploaded signature image |
| logo_url | text | University logo |
| card_bg_color | text | Background/accent color |
| updated_at | timestamptz | |

RLS: Admins can manage both tables; students can SELECT their own ID card row.

### ID Card Design (Landscape, Standard CR80 — 3.375" x 2.125")

```text
+----------------------------------------------------+
| [Logo]  ONLINE TEXTILE SCHOOL                      |
|         Dhaka, Bangladesh                          |
|----------------------------------------------------|
|                                                    |
|  +--------+   Name: Md. Mahbub Alam               |
|  |        |   Roll: OTS-123456                     |
|  | PHOTO  |   Blood Group: B+                      |
|  |        |   Date of Birth: 01 Jan 1995           |
|  +--------+   Address: Mirpur, Dhaka               |
|                                                    |
|  Valid Until: December 2026                        |
|                         [Signature Image]          |
|                         Authority Name             |
|                         Position Title             |
|----------------------------------------------------|
|  ||||||||||||||||| BARCODE |||||||||||||||||        |
|  OTS-ID-000123                                     |
+----------------------------------------------------+
```

### Expiry Calculation Logic

- Each **paid** enrollment (where `payment_id IS NOT NULL`) adds 6 months
- If a student has 2 paid courses: 12 months from first enrollment
- On new enrollment, recalculate `valid_until` and update the card
- Admin-granted (free) enrollments do NOT extend validity

### New Files

| File | Purpose |
|------|---------|
| `src/lib/idCardRenderer.ts` | Canvas-based ID card renderer + PDF download using jsPDF (similar pattern to `certificateRenderer.ts`) |
| `src/components/student/StudentIdCard.tsx` | Preview component showing the rendered card with download button |
| `src/pages/admin/AdminIdCardSettings.tsx` | Admin page: configure authority name/position, upload signature, set university name/location |

### Modified Files

| File | Change |
|------|--------|
| `src/pages/admin/StudentDetail.tsx` | Add "ID Card" tab showing card preview, validity dates, manual extend/revoke controls |
| `src/pages/admin/AdminStudents.tsx` | Add ID card status column (Active/Expired/None), bulk issue ID cards action |
| `src/pages/dashboard/DashboardOverview.tsx` | Add ID card preview widget if student has active card |
| `src/pages/Profile.tsx` | Add ID card section with preview and PDF download |
| `src/components/layout/AdminSidebar.tsx` | Add "ID Card Settings" link under setup or settings |
| `src/App.tsx` | Add route for `/admin/id-card-settings` |

### Implementation Details

**ID Card Renderer (`idCardRenderer.ts`):**
- Uses HTML Canvas to draw the card at 2x resolution (1012 x 638 px for CR80)
- Draws header with university name and location
- Places student photo (square, from `avatar_url`)
- Renders fields: Name, Roll ID, Blood Group, DOB, Address (district + division)
- Draws expiry date and authority signature section
- Generates barcode using the card number (Code128 via a lightweight canvas barcode lib, or custom drawn)
- Exports to PDF via jsPDF at exact CR80 dimensions

**Auto-generation trigger:**
- When a student makes a paid enrollment, check if ID card exists:
  - If no: create new card with `valid_from = now()`, `valid_until = now() + 6 months`
  - If yes: update `valid_until += 6 months`
- This logic runs client-side when viewing the card or can be triggered from admin

**Barcode:**
- Encode the `card_number` as Code128 barcode drawn directly on canvas (no external lib needed — simple Code128 implementation or use `JsBarcode` library)

**Admin ID Card Management:**
- Settings page: edit university name, location, authority details, upload signature image
- StudentDetail: view/preview any student's ID card, manually extend validity, deactivate card
- AdminStudents: see card status column, bulk generate cards for students with paid enrollments who don't have one yet

**Student-facing:**
- Profile page and Dashboard show ID card preview (canvas rendered)
- "Download ID Card" button generates PDF at print-quality resolution
- Card only visible if student has at least one paid enrollment

### Migration SQL

```sql
CREATE TABLE public.student_id_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  card_number text NOT NULL UNIQUE,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.student_id_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own id card" ON public.student_id_cards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins manage id cards" ON public.student_id_cards
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TABLE public.id_card_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_name text NOT NULL DEFAULT 'Online Textile School',
  location text NOT NULL DEFAULT 'Dhaka, Bangladesh',
  authority_name text DEFAULT '',
  authority_position text DEFAULT '',
  signature_url text DEFAULT '',
  logo_url text DEFAULT '',
  card_bg_color text DEFAULT '#1a365d',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.id_card_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view id card settings" ON public.id_card_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage id card settings" ON public.id_card_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Seed default settings row
INSERT INTO public.id_card_settings (university_name, location) VALUES ('Online Textile School', 'Dhaka, Bangladesh');
```

### Execution Order

1. Run migration (2 tables + RLS + seed)
2. Create `idCardRenderer.ts` (canvas + barcode + PDF)
3. Create `StudentIdCard.tsx` component
4. Create `AdminIdCardSettings.tsx` page
5. Update `StudentDetail.tsx` — add ID Card tab
6. Update `AdminStudents.tsx` — add card status column + bulk generate
7. Update `Profile.tsx` and `DashboardOverview.tsx` — add card preview/download
8. Update `AdminSidebar.tsx` and `App.tsx` — add routes

Total: 1 migration, 3 new files, 6 edited files.

