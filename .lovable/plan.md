

## Plan: Cloudflare R2 Multi-Account Upload System with Round-Robin

### Overview
Replace the Cloudinary flow for heavy files (PDFs, videos, documents, archives) with a Cloudflare R2 presigned-URL upload system. Images stay on Cloudinary. Multiple R2 accounts rotate via round-robin to stay within free-tier limits.

### Architecture

```text
User uploads file
       │
       ▼
  Check MIME/ext
       │
  ┌────┴────┐
  │ Image?  │ Yes → Cloudinary (existing flow)
  └────┬────┘
       │ No (PDF/video/doc/archive)
       ▼
  Edge Function: r2-presign
       │
  1. Fetch active R2 accounts from DB
  2. Round-robin select next account
  3. Generate presigned PUT URL via @aws-sdk
  4. Return presigned URL + public URL
       │
       ▼
  Frontend PUT directly to R2
  (bypasses Vercel/edge 4.5MB limit)
       │
       ▼
  Save public URL to Supabase
```

### Changes Required

#### 1. Database: `cloudflare_r2_accounts` table (migration)

```sql
CREATE TABLE public.cloudflare_r2_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname text NOT NULL,
  access_key_id text NOT NULL,
  secret_access_key text NOT NULL,
  endpoint_url text NOT NULL,
  bucket_name text NOT NULL,
  public_domain_url text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_used_at timestamptz,
  upload_count bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.cloudflare_r2_accounts ENABLE ROW LEVEL SECURITY;

-- Only admins can manage R2 accounts
CREATE POLICY "Admins manage R2 accounts"
  ON public.cloudflare_r2_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Round-robin tracker
CREATE TABLE public.r2_round_robin_state (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_account_id uuid REFERENCES public.cloudflare_r2_accounts(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.r2_round_robin_state (id) VALUES (1);

ALTER TABLE public.r2_round_robin_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage RR state"
  ON public.r2_round_robin_state FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

#### 2. Edge Function: `r2-presign`

- **Actions**: `presign` (generate upload URL), `test` (verify R2 credentials)
- Uses `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` (Deno npm imports)
- Round-robin: fetches active accounts ordered by `created_at`, picks the one after `last_account_id`, wraps around
- Generates presigned PUT URL (1 hour expiry)
- Returns `{ presignedUrl, publicUrl, accountId }` to frontend
- Updates `last_account_id` and increments `upload_count`

#### 3. Frontend: `useFileUpload` hook (new central upload hook)

- Replaces direct use of `useCloudinaryUpload` in `MediaUploader`
- File type checking logic:
  - **Images** (jpg, png, gif, webp, svg, tiff) → existing Cloudinary flow
  - **Heavy files** (pdf, mp4, mkv, avi, pptx, ppt, psd, ai, zip, rar, doc, docx, xls, xlsx, mov, webm) → R2 presigned flow
- R2 flow: call edge function → get presigned URL → `fetch(PUT)` directly to R2 → return public URL
- Progress tracking via `XMLHttpRequest` for upload progress bar

#### 4. Admin UI: `CloudflareR2SettingsTab.tsx`

- Identical design pattern to `CloudinarySettingsTab.tsx`
- Fields: Nickname, Access Key ID, Secret Access Key, Endpoint URL, Bucket Name, Public Domain URL, Status toggle
- Test button calls edge function `r2-presign` with `action: 'test'`
- CRUD via Supabase `cloudflare_r2_accounts` table
- Stats cards: Total Accounts, Active, Upload Count

#### 5. Sidebar & Routing Updates

- **AdminSidebar.tsx**: Add `{ title: 'Cloudflare R2', url: '/admin/setup/cloudflare-r2', icon: HardDrive }` to `setupSubItems`
- **AdminSetup.tsx**: Register `'cloudflare-r2': CloudflareR2SettingsTab` in `tabComponents` and `tabTitles`

#### 6. Update `MediaUploader.tsx`

- Replace `useCloudinaryUpload` with new `useFileUpload` hook
- The hook internally routes to Cloudinary or R2 based on file type
- No other component changes needed — the hook abstracts the routing

#### 7. Ebook Reader Compatibility

- The EbookReader already fetches PDFs via the `ebook-secure-access` edge function which streams bytes
- For R2-hosted ebooks, the edge function will fetch from the R2 public URL (already supports any HTTP URL)
- CORS: R2 public domains serve with permissive CORS by default; the presigned URL approach avoids CORS issues during upload
- Download links: existing material download buttons use direct URLs — R2 public URLs work identically

### Files to Create/Edit

| Action | File |
|--------|------|
| Create | `supabase/functions/r2-presign/index.ts` |
| Create | `src/pages/admin/setup/CloudflareR2SettingsTab.tsx` |
| Create | `src/hooks/useFileUpload.ts` |
| Edit | `src/pages/admin/AdminSetup.tsx` (add R2 tab) |
| Edit | `src/components/layout/AdminSidebar.tsx` (add menu item) |
| Edit | `src/components/instructor/MediaUploader.tsx` (use new hook) |
| Migration | Create `cloudflare_r2_accounts` + `r2_round_robin_state` tables |

### Security Notes
- R2 secret keys stored in DB (encrypted at rest by Supabase), accessed only by edge function (service role)
- Presigned URLs expire in 1 hour, are single-use for PUT
- Admin-only RLS on the accounts table using existing `has_role()` function

