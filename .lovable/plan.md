

# Fix Email Logo: Add Upload via MediaPickerModal (Cloudinary)

## Problem
The Email Branding "Logo URL" field is a plain text input where you must paste a URL manually. Every other admin section (Hero Slides, Events, Learning Paths, etc.) uses `MediaPickerModal` which lets you upload images via Cloudinary or pick from the media library.

## What Changes

### `src/pages/admin/setup/SmtpSettingsTab.tsx`
1. Import `MediaPickerModal` and add state for `mediaOpen`
2. Replace the plain Logo URL `<Input>` with a layout that has:
   - The existing text input (so you can still paste a URL)
   - An **"Upload / Pick"** button that opens `MediaPickerModal`
   - When an image is selected from the picker, it sets `email_logo_url` automatically
3. This matches the exact same pattern used in `AdminHeroSlides`, `AdminEvents`, `AdminLearningPaths`, etc.

### No other files need changes
- `MediaPickerModal` already handles Cloudinary upload internally via `useFileUpload`
- No new dependencies

## Technical Detail
The pattern is identical to other admin pages:
```tsx
<MediaPickerModal
  open={mediaOpen}
  onClose={() => setMediaOpen(false)}
  onSelect={(url) => {
    setForm(p => ({ ...p, email_logo_url: url }));
    setMediaOpen(false);
  }}
/>
```

