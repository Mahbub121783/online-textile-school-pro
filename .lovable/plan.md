# Fix Course Description rendering + Admin Instructor Reassignment

## Problems observed (from screenshots)

1. **Course Detail "About This Course"** is showing raw HTML markup (long `<span class="html-span ...">`, Facebook emoji `<img>` tags, inline `style="..."` blobs) instead of formatted text. Root cause: `CourseDetail.tsx` line 374 renders `course.description` as plain text inside a `whitespace-pre-line` div, but the value stored from `RichTextEditor` is HTML. When the admin pastes from Facebook/Word, the editor saves the entire pasted HTML payload (with `xexx8yu` FB classes and external emoji `<img>`s), and on the public page that HTML is shown verbatim as escaped text.
2. **RichTextEditor has no paste sanitization** — anything copied from Facebook/Word/Docs gets stored with hostile inline styles, FB CSS class names, tracking-pixel emoji images, and `data-` attrs.
3. **Admin cannot reassign the instructor of an existing course from the Settings tab** in some cases — the picker exists but only when `isAdmin` and the field becomes empty when `course.instructor_id` is the admin themself; we'll make it always editable + show the current instructor name clearly + allow change/save.

## Changes

### 1. Render course description as sanitized HTML (`src/pages/courses/CourseDetail.tsx`)
- Replace the plain-text `<div>{course.description}</div>` with a sanitized HTML render.
- Add a tiny inline sanitizer (no new dep) that:
  - Parses the HTML in a detached `DOMParser` document.
  - Strips `<script>`, `<style>`, `<iframe>` (except YouTube/Vimeo), `<link>`, event handlers (`on*`), `style` attributes, `class` attributes, and `data-*` attributes.
  - Removes `<img>` tags whose `src` points to `static.xx.fbcdn.net` / `emoji.php` (Facebook emoji pixels) — replaces them with their `alt` text so the actual emoji character survives.
  - Unwraps empty `<span>`/`<font>` wrappers.
  - Keeps safe tags: `p, br, strong, b, em, i, u, h1-h6, ul, ol, li, a, blockquote, hr, img, code, pre`.
  - For `<a>`: forces `target="_blank" rel="noopener noreferrer"`.
- Wrap output in `<div class="prose prose-sm dark:prose-invert max-w-none">` so Tailwind typography styles it nicely.
- Apply the same renderer to other public surfaces that show course/workshop/ebook long descriptions to prevent the same issue (`WorkshopDetail.tsx`, `EbookDetail.tsx`).

### 2. Clean paste in `RichTextEditor` (`src/components/instructor/RichTextEditor.tsx`)
- Add an `onPaste` handler that:
  - Calls `e.preventDefault()`.
  - Reads `text/html` from clipboard, runs it through the same sanitizer (extracted to `src/lib/htmlSanitize.ts`), and inserts the clean HTML via `document.execCommand('insertHTML', false, clean)`.
  - Falls back to `text/plain` when no HTML is available.
- Also sanitize the existing value once on mount so old polluted descriptions get cleaned the next time the admin edits and saves.
- New shared util: `src/lib/htmlSanitize.ts` exporting `sanitizeRichHtml(input: string): string` used by both the editor and the public renderers.

### 3. Admin can change the assigned instructor of any course (`src/pages/instructor/CourseBuilder.tsx`)
- The instructor picker already exists for admins; harden it:
  - In Settings tab, show a clear **"Assigned Instructor"** card with the current instructor's avatar + name + email, plus a "Change" button that opens the searchable list (current radio list) inline.
  - The selection is **never auto-cleared** by reloads — initialize `form.instructor_id` from `course.instructor_id` and treat empty string as "unchanged".
  - Save logic: when admin picks a different instructor, write `instructor_id = picked` (allow reassignment to any user with role `instructor`/`admin`/`super_admin`); when admin leaves it untouched, keep `course.instructor_id` (do not silently overwrite with the admin's own id).
  - Show a toast: `"Course reassigned to {name}"` when `instructor_id` actually changes.
  - Keep the picker hidden for non-admin instructors (they can't reassign their own courses).

### 4. Minor: Featured Image preview alt
- Ensure `MediaUploader` shows a proper broken-image fallback (placeholder svg) when `value` is set but URL fails to load — small `onError` swap to `/placeholder.svg`.

## Technical notes

```text
src/lib/htmlSanitize.ts            (new)  — sanitizeRichHtml()
src/components/instructor/RichTextEditor.tsx
   + onPaste handler -> sanitizeRichHtml -> insertHTML
   + sanitize initial value once
src/pages/courses/CourseDetail.tsx
   - <div whitespace-pre-line>{description}</div>
   + <div className="prose ..." dangerouslySetInnerHTML={{__html: sanitizeRichHtml(description)}} />
src/pages/static/WorkshopDetail.tsx, src/pages/ebooks/EbookDetail.tsx
   + same sanitized renderer for long description fields
src/pages/instructor/CourseBuilder.tsx
   + "Assigned Instructor" summary card in Settings
   + reassignment-aware save logic + toast
src/components/instructor/MediaUploader.tsx
   + <img onError fallback to /placeholder.svg>
```

No new npm dependencies — sanitizer uses the built-in `DOMParser`. No DB schema changes.

## Result

- Public course/workshop/ebook pages render properly formatted descriptions (bold, lists, paragraphs, emojis), never raw HTML.
- Pasting from Facebook/Word/Docs in the admin editor automatically strips junk classes, inline styles, FB emoji pixels, and scripts.
- Admins can pick **any** instructor (not just themselves) when creating or editing a course, and can reassign existing courses from the Settings tab without losing the current value.
