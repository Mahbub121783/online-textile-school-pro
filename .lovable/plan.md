

## Deep diagnosis

The migration is failing because the current `migrate-storage-to-cloud` function is still too heavy even after batching.

What I found from the code and logs:
- The function still **recursively scans the entire `media` bucket on every request** before processing only 3 files.
- It then **downloads files into memory and base64-encodes them inside the function**.
- It also calls **other auth-protected edge functions** (`cloudinary-proxy`, `r2-presign`) from inside the migration function, which is fragile because the request auth context is not being forwarded explicitly.
- The Supabase logs for this function show mostly **boot/shutdown with no useful app error**, which strongly suggests a **hard runtime crash / resource kill** before normal error handling completes.
- There are still real legacy files to migrate (`media_library` and `user_profiles.avatar_url` still contain Supabase URLs), so this is not a “nothing to do” case.

## Root cause

This is not just a small bug. The current design is wrong for edge runtime limits:
1. Full bucket traversal per batch
2. Large in-memory base64 conversion
3. Nested edge-function calls during migration
4. UI loop repeatedly triggering that expensive work

## Fix strategy

### 1. Redesign the migration function as a queue worker
Refactor `supabase/functions/migrate-storage-to-cloud/index.ts` so it does **not** scan + migrate in one expensive pass.

New actions:
- `scan` — seed `storage_migration_log` with legacy files in small pages
- `migrate-next` — migrate only the next pending item (or very tiny batch)
- `status` — return counts
- `retry-failed` — optionally retry failed rows

### 2. Stop scanning the whole bucket every time
Replace recursive `storage.from('media').list()` traversal with a lightweight queued approach:
- Read legacy objects in small chunks
- Upsert them into `storage_migration_log`
- After that, each migration request works only from the log table

This avoids repeated bucket-wide work on every click/loop.

### 3. Remove base64-heavy migration logic
Keep the upload rule:
- Images → Cloudinary
- Other files → Cloudflare R2

But change how migration uploads happen:
- **Images:** upload directly to Cloudinary from the public Supabase URL or direct binary upload inside the function
- **Other files:** upload directly to R2 with the AWS S3 client already used in `r2-presign`

Do **not** call `cloudinary-proxy` or `r2-presign` from inside the migration worker.

### 4. Add robust failure tracking
Extend the queue behavior so each row records:
- `status`
- `error_message`
- `attempt_count`
- timestamps for started/completed

This prevents infinite retry loops and makes failures inspectable.

### 5. Update Admin Media UI to use the queue
Refactor `src/pages/admin/AdminMedia.tsx`:
- Step 1: scan legacy files
- Step 2: run repeated `migrate-next` calls
- Show:
  - current progress
  - current file being processed
  - images moved to Cloudinary
  - files moved to R2
  - failed count
- Add a separate **Retry failed** action
- Stop cleanly when no pending rows remain

## Files to change

| File | Change |
|---|---|
| `supabase/functions/migrate-storage-to-cloud/index.ts` | Rewrite into scan/status/migrate-next queue worker; remove recursive full scan per batch and remove nested edge-function calls |
| `src/pages/admin/AdminMedia.tsx` | Switch from current `while(hasMore)` batch loop to queue-based scan + migrate flow with better progress and retry UI |
| `supabase/migrations/...sql` | Add retry/progress columns to `storage_migration_log` if needed (`attempt_count`, `started_at`, `last_error_at`) |

## Expected result

After this refactor:
- migration will stop crashing from edge resource exhaustion
- images will migrate only to Cloudinary
- all non-image files will migrate only to Cloudflare R2
- Supabase legacy files will be processed safely one-by-one / tiny-batch
- failures will be visible instead of silently dying
- admin will be able to resume and retry without restarting the whole migration

## Implementation note

I do **not** plan to touch the normal upload rule. That rule is already correct:
- new images → Cloudinary
- new other files → R2
- new uploads → never Supabase

The work is specifically to make the **legacy migration path** reliable.

