

## Plan: Media Library Picker System for All Upload Areas

### What We're Building

A reusable `MediaPickerModal` component that replaces (or wraps) the current `MediaUploader` everywhere except the Admin Media page. When a user clicks to upload, they get a modal with two tabs:

1. **Upload Files** — the existing drag-and-drop upload (which also saves to `media_library`)
2. **Media Library** — browse/search/filter already-uploaded media and select one

This matches the pattern shown in the screenshot (the "Select OG / Share Image" dialog with Upload Files + Media Library tabs, All/Image filters, search, and Cancel/Select buttons).

### Files to Create/Edit

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/components/shared/MediaPickerModal.tsx` | Reusable modal with Upload + Media Library tabs |
| Edit | `src/components/instructor/MediaUploader.tsx` | Add a "Media Library" button that opens the picker modal; auto-save uploads to `media_library` table |
| No change | `src/pages/admin/AdminMedia.tsx` | Excluded per user request |

### How It Works

**MediaPickerModal** component:
- Props: `open`, `onClose`, `onSelect(url: string)`, `accept?: string` (to filter file types)
- Two tabs: "Upload Files" and "Media Library"
- **Upload Files tab**: Drag-and-drop zone using `useFileUpload`, automatically inserts into `media_library` table on success
- **Media Library tab**: Queries `media_library` table, shows grid of thumbnails (images) and file icons (non-images), with type filter buttons (All / Image / Document / Video) and search input
- Cancel and Select buttons at the bottom
- Selected item highlighted with a ring/border

**MediaUploader changes**:
- When no value is set, show the existing upload drop zone PLUS a small "or choose from Media Library" button
- Clicking that button opens `MediaPickerModal`
- On file upload via drag-and-drop, also insert into `media_library` (so future uploads appear in the library)
- The `accept` prop is passed through to filter the library view

### All Usage Locations (auto-covered via MediaUploader)

Since all upload areas use `MediaUploader`, updating it once covers:
- `CourseBuilder.tsx` — featured image, video, OG image
- `LessonModal.tsx` — video upload, attachments
- `MaterialUploadModal.tsx` — material file upload
- `AdminAppearance.tsx` — site logos, favicons, OG images
- `LessonMakerTab.tsx` — lesson media

### Technical Details

- Queries: `supabase.from('media_library').select('*').order('created_at', { ascending: false })`
- Filter by type: client-side filter on `file_type` column (starts with `image/`, `video/`, `application/pdf`, etc.)
- Search: client-side filter on `file_name`
- Upload-to-library insert: `supabase.from('media_library').insert({ file_url, file_name, file_type, file_size, uploaded_by })`
- Uses existing `useAuth` for `uploaded_by` user ID
- Total new files: 1. Total edited files: 1.

