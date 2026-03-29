

## Plan: Fix Image Uploads (Missing Edge Function) + R2 CORS Issue

### Root Cause Found

**The `cloudinary-proxy` edge function does not exist.** The project has only one edge function (`r2-presign`). When you upload an image:

1. `useFileUpload` detects it's an image and routes to `useCloudinaryUpload`
2. `useCloudinaryUpload` calls `supabase.functions.invoke('cloudinary-proxy', ...)`
3. That function doesn't exist, so the call fails silently
4. The image "vanishes" because it was never uploaded anywhere

For R2 (PDFs/videos): The presigned URL is generated server-side, but the browser PUT to R2 is blocked by **missing CORS on your R2 bucket**. The upload_count of 2 in the database was from a previous code version that didn't have proper verification.

### Fix (2 steps)

**Step 1: Create the `cloudinary-proxy` edge function**

Create `supabase/functions/cloudinary-proxy/index.ts` that:
- Reads Cloudinary account credentials from `cloudinary_accounts` table (using service role)
- On `action: 'upload'` -- receives base64 file data, uploads to Cloudinary API using the account's `cloud_name`, `api_key`, and `api_secret`, returns the URL
- On `action: 'test'` -- pings Cloudinary API with the account credentials to verify connectivity
- Handles category-based account selection (images go to the account with `file_category = 'images'`)
- Falls back to primary account if no category match

**Step 2: Add a `proxy-upload` action to `r2-presign` edge function (for R2 CORS bypass)**

Since your Cloudflare R2 bucket does not have CORS configured (and configuring CORS on R2 free tier requires using the S3 API or Wrangler), add a server-side upload path:
- New action `proxy-upload` in the existing `r2-presign` function
- Instead of giving the browser a presigned URL, the edge function receives the file (up to ~4.5MB via base64) and uploads it to R2 directly from the server
- This completely bypasses the CORS issue
- For files larger than 4.5MB, keep the presigned URL path but show a clear error if CORS blocks it

Update `useFileUpload.ts` to:
- Try proxy upload first for files under 4.5MB
- Fall back to presigned URL for larger files
- Show clear CORS error message if presigned URL upload fails

### Files Changed

| Action | File |
|--------|------|
| Create | `supabase/functions/cloudinary-proxy/index.ts` |
| Edit | `supabase/functions/r2-presign/index.ts` (add proxy-upload action) |
| Edit | `src/hooks/useFileUpload.ts` (add proxy upload path for small R2 files) |

### Technical Details

The cloudinary-proxy function will use Cloudinary's upload API (`https://api.cloudinary.com/v1_1/{cloud_name}/auto/upload`) with signed uploads using `api_key` and `api_secret` from the database. The signature is generated server-side using SHA-1 as required by Cloudinary.

The R2 proxy upload encodes the file as base64 in the request body to the edge function, which then uses the S3 `PutObjectCommand` with the actual file bytes. This avoids any browser CORS requirements.

