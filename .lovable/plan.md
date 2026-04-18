

## Goal
Eliminate Supabase Storage for media. Route every upload to Cloudinary (images) or Cloudflare R2 (everything else). Migrate existing Supabase-hosted files. Block new uploads to the `media` bucket.

## Audit findings
The `media` bucket is still actively used by code paths that bypass `useFileUpload`. Routing today is by file extension, not by size — so the user's "anything >50KB never goes to Supabase" rule isn't enforced anywhere. Avatars were just migrated to Cloudinary, but other handlers (assignment uploads, mail attachments, hero slides, popup media, ID card photos, registration attachments, profile editor) likely still hit Supabase directly.

## Plan

### 1. Update routing rule in `useFileUpload`
- Images of any size → Cloudinary (keep optimization benefits like `f_auto,q_auto`)
- Everything else → Cloudflare R2 (uses existing chunked proxy for >4.5MB)
- Hard-block fallback: hook never calls `supabase.storage` under any condition
- Add a console warning + thrown error if any caller passes a file Supabase would have handled

### 2. Replace every direct Supabase Storage call
Search the codebase for `supabase.storage`, `.from('media')`, `.upload(` and rewrite each handler to use `useFileUpload().upload(file)`. Likely files needing fixes:
- Assignment submission (`AssignmentSubmit.tsx`)
- Forum / discussion attachments
- Mail compose attachments (`ComposeModal.tsx`)
- Hero slides admin (`AdminHeroSlides.tsx`)
- Popup builder media
- ID card photo upload
- Public profile editor
- Registration form attachments
- Research paper submissions
- Any remaining components found during sweep

### 3. One-time migration edge function
Create `migrate-storage-to-cloud`:
- Lists all objects in Supabase `media` bucket
- For each: downloads → re-uploads to Cloudinary (image) or R2 (other)
- Updates DB references in tables: `user_profiles.avatar_url`, `media_library.file_url`, `posts.featured_image_url`, `courses.thumbnail_url`, `ebooks.cover_url`, `hero_slides.media_url`, `popup_settings`, `assignment_submissions`, etc.
- Logs each migration row to a new `storage_migration_log` table (idempotent — skips already-migrated URLs)
- Optional cleanup pass deletes Supabase originals after success

### 4. Lock down the bucket
- RLS on `storage.objects` for `media` bucket: deny all new INSERTs (read still allowed for legacy URLs that haven't migrated yet)
- Once migration verified clean, optional second migration drops the bucket entirely

### 5. Admin UI
- Add "Migrate Supabase files to cloud" button on `AdminMedia.tsx` with progress indicator and result log
- Show source badges (Cloudinary / R2 / Supabase-legacy) per item

## Files to Edit / Create

| File | Change |
|---|---|
| `src/hooks/useFileUpload.ts` | Hard-route: images→Cloudinary, all else→R2; never touch Supabase Storage |
| Multiple `src/pages/**` and `src/components/**` upload handlers | Replace `supabase.storage` calls with `useFileUpload` |
| `supabase/functions/migrate-storage-to-cloud/index.ts` (new) | One-time migration function |
| `supabase/migrations/...sql` (new) | `storage_migration_log` table + RLS to deny new uploads to `media` bucket |
| `src/pages/admin/AdminMedia.tsx` | Migration trigger button + source badges |

## Result
- Zero new files reach Supabase Storage — guaranteed at the hook level
- All existing files migrated to Cloudinary/R2 with DB URLs updated
- `media` bucket becomes read-only for legacy URLs, then deletable
- Source badges in admin make routing visible

## Quick clarification before execution

**Threshold**: Your message says "any single file photo or 50kb above file never ever goes to supabase". I'm reading this as: **no file of any size or type goes to Supabase, ever** (the strictest interpretation). Images route to Cloudinary, non-images to R2. The 50KB number won't matter because nothing reaches Supabase regardless.

If you actually meant "files >50KB → R2, smaller files → Cloudinary" (a size-based split), tell me and I'll adjust the routing rule. Otherwise I'll proceed with the simpler "images→Cloudinary, rest→R2, Supabase never" rule once you approve.

