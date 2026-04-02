

## Plan: System-Wide Audit Findings & Fixes

### Audit Summary

After examining console logs, all hooks, components, edge functions, layouts, and database schema, here are the findings organized by severity.

### Issues Found

**1. Duplicate `media_library` Inserts (Medium)**
Both `MediaUploader.tsx` and `MediaPickerModal.tsx` insert into `media_library` after upload. If a user uploads via the MediaUploader drop zone, it inserts a row. If they then open MediaPickerModal and upload there, it also inserts. But the worse scenario: `AdminMedia.tsx` ALSO inserts into `media_library` on upload. This means any upload from the admin media page creates duplicate entries since `MediaUploader` (used elsewhere) also saves to library. No deduplication exists -- the same file URL can appear multiple times.

**Fix:** Add a `UNIQUE` constraint on `file_url` in `media_library` table, and change all inserts to `upsert` with `onConflict: 'file_url'` to prevent duplicates.

**2. `lesson_progress` Upsert Missing Unique Constraint (Medium)**
`useMarkLessonComplete` uses `upsert` with `onConflict: 'user_id,lesson_id'`, but the `lesson_progress` table schema shows no unique constraint on `(user_id, lesson_id)`. This will cause the upsert to fail or create duplicate progress rows.

**Fix:** Add a unique constraint on `lesson_progress(user_id, lesson_id)` via migration.

**3. Missing Database Trigger for `handle_new_user` (Low-Medium)**
The `handle_new_user()` function exists but no trigger is attached to `auth.users`. The DB triggers section says "There are no triggers in the database." This means new user signups may not auto-create profiles, roles, or wallets.

**Fix:** Verify by checking if the trigger exists (it may be in the auth schema which is hidden from the listing). If missing, the trigger must be created. However, since we cannot modify `auth` schema directly, this likely already exists but is just not shown. We should verify via a test signup.

**4. `QueryClient` Created Outside Component (Low)**
`const queryClient = new QueryClient()` is at module scope in `App.tsx`. This is fine for single-instance apps but can cause subtle issues with SSR or tests. For this client-side-only app, it is acceptable but could be wrapped in a lazy initializer for best practice.

**5. React `forwardRef` Warnings (Low - Cosmetic)**
Console shows many "Function components cannot be given refs" warnings. The root cause is `App` defined as an arrow function const (`const App = () => ...`). React Router's `BrowserRouter` tries to pass a ref through the component tree. These are dev-mode only warnings and do not affect production.

**Fix:** No action needed -- these are cosmetic dev warnings.

**6. React Router v6 Deprecation Warnings (Low)**
Console warns about `v7_relativeSplatPath` and `v7_startTransition` future flags. These are informational for v7 migration prep.

**Fix:** Add future flags to `BrowserRouter` to suppress warnings: `<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>`.

**7. `notifications` Table Type Casting (Low)**
`useNotifications.ts` and `notifications.ts` use `supabase.from('notifications' as any)` suggesting the table may not be in the generated types. This works but loses type safety.

**8. No Foreign Keys Defined (Architectural - No Fix Needed)**
All tables show "No foreign keys" in the schema dump. This is intentional for flexibility but means referential integrity relies on application logic.

### Implementation Plan

| Step | Action | File |
|------|--------|------|
| 1 | Add unique constraint on `media_library(file_url)` | DB migration |
| 2 | Add unique constraint on `lesson_progress(user_id, lesson_id)` | DB migration |
| 3 | Change all `media_library` inserts to use `.upsert()` with `onConflict: 'file_url'` | `MediaUploader.tsx`, `MediaPickerModal.tsx`, `AdminMedia.tsx` |
| 4 | Add React Router future flags to suppress deprecation warnings | `App.tsx` |
| 5 | Verify `handle_new_user` trigger exists (query `information_schema`) | Investigation only |

### Technical Details

**Migration SQL:**
```sql
-- Deduplicate existing media_library rows before adding constraint
DELETE FROM media_library a USING media_library b
WHERE a.id > b.id AND a.file_url = b.file_url;

ALTER TABLE media_library ADD CONSTRAINT media_library_file_url_unique UNIQUE (file_url);

-- Add unique constraint for lesson progress upsert
ALTER TABLE lesson_progress ADD CONSTRAINT lesson_progress_user_lesson_unique UNIQUE (user_id, lesson_id);
```

**Upsert pattern (replacing `.insert()`):**
```typescript
await supabase.from('media_library').upsert({
  file_url: result.url,
  file_name: file.name,
  file_type: file.type,
  file_size: file.size,
  uploaded_by: user?.id,
}, { onConflict: 'file_url' });
```

**React Router future flags:**
```tsx
<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
```

Total: 1 migration, 4 file edits. No breaking changes.

