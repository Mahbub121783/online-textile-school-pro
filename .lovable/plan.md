

# Advanced Block Editor for Blog Posts (Gutenberg-style)

## Overview

Replace the current simple dialog-based post creation with a dedicated full-page block editor, similar to WordPress Gutenberg. The editor will support rich content blocks with drag-and-drop reordering, inline editing, media picker integration, tables, headings, quotes, lists, embeds, and a live preview. Accessible to admin, super_admin, and instructor roles.

## Current State

- `AdminPosts.tsx`: Simple table + dialog with title/slug/excerpt/category/status fields. No content editing.
- `PageEditor.tsx`: Existing block editor for CMS pages with text/image/video/button/columns/spacer/HTML blocks -- but uses raw textarea for text (no rich editing).
- `BlockRenderer.tsx`: Renders 7 block types. Already used by `BlogPost.tsx` for the public view.
- `RichTextEditor.tsx`: Basic contentEditable editor with bold/italic/underline/list toolbar.
- `MediaPickerModal.tsx`: Full-featured media library picker (upload + browse).
- Posts table already has `content: Json` column for block storage and `tags: string[]`.

## What We Will Build

### 1. New Dedicated Post Editor Page (`src/pages/admin/PostEditor.tsx`)

A full-page editor (not a popup) with two-panel layout:

**Left Panel (Content Area ~70%)**:
- Large inline-editable title field
- Block canvas with drag-to-reorder (using array index swap, no extra lib)
- Each block shows inline editing controls on hover/focus
- "Add Block" inserter between blocks (+ button) with categorized block palette
- Floating toolbar per block (move up/down, duplicate, delete, change type)

**Right Sidebar (~30%)**:
- **Post Settings**: slug (auto-gen), category (dropdown + custom), tags (multi-input chips), excerpt
- **Featured Image**: thumbnail preview + MediaPickerModal integration
- **Status & Publish**: draft/published toggle, scheduled publishing (date picker), publish button
- **SEO Preview**: title + excerpt preview as it would appear on blog list
- **Author info** (read-only, shows current user)

### 2. Extended Block Types (upgrade `BlockRenderer.tsx`)

Add these new block types to both the editor and renderer:

| Block | Description |
|-------|-------------|
| `heading` | H2/H3/H4 with level selector |
| `quote` | Blockquote with citation field |
| `list` | Ordered/unordered list items editor |
| `table` | Row/column grid editor with add/remove rows/cols |
| `divider` | Horizontal rule (simple) |
| `callout` | Colored info/warning/success box with icon |
| `gallery` | Multi-image grid with MediaPicker |
| `code` | Code block with syntax label |
| `embed` | Generic URL embed (social media, etc.) |

Existing types (text, image, video, button, columns, spacer, html) remain.

### 3. Rich Text Editing for Text Blocks

Upgrade the text block editing from raw textarea to an enhanced `RichTextEditor` with:
- Heading levels (H2-H4 via dropdown)
- Bold, italic, underline, strikethrough
- Bullet/numbered lists
- Links (with URL dialog)
- Image insertion via MediaPickerModal
- Blockquote toggle
- Text alignment (left/center/right)
- Undo/redo
- Clear formatting

### 4. Table Block Editor

Interactive table editor:
- Default 3x3 grid
- Add/remove rows and columns via buttons
- Editable cells (contentEditable)
- Header row toggle
- Stores as `{ headers: string[], rows: string[][] }`

### 5. Routes & Navigation

- New route: `/admin/posts/new` and `/admin/posts/:postId/edit` -> `PostEditor`
- Update `AdminPosts.tsx`: "New Post" navigates to `/admin/posts/new`, edit button navigates to `/admin/posts/:id/edit`
- Remove the dialog from AdminPosts
- Add instructor route: `/instructor/posts` (list) + `/instructor/posts/new` + `/instructor/posts/:postId/edit`
- Add "Blog Posts" to `InstructorSidebar.tsx`

### 6. Instructor Access

Instructors get the same editor but can only see/edit their own posts (filter by `author_id`). Admin/super_admin can see all posts.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/pages/admin/PostEditor.tsx` | **New** -- full-page Gutenberg-style block editor |
| `src/pages/admin/AdminPosts.tsx` | Refactor: remove dialog, navigate to PostEditor |
| `src/pages/instructor/InstructorPosts.tsx` | **New** -- instructor post list (own posts only) |
| `src/components/cms/BlockRenderer.tsx` | Add heading, quote, list, table, divider, callout, gallery, code, embed blocks |
| `src/components/instructor/RichTextEditor.tsx` | Add heading dropdown, alignment, strikethrough, blockquote, clear formatting |
| `src/components/layout/InstructorSidebar.tsx` | Add "Blog Posts" nav item |
| `src/App.tsx` | Add PostEditor routes for admin + instructor |

No database migration needed -- `posts.content` is already JSONB and can store the extended block types.

## Technical Details

- Block data stored as `ContentBlock[]` in the `posts.content` JSONB column
- Extended `ContentBlock` interface to include new types and their properties (e.g., `headingLevel`, `citation`, `listItems`, `tableData`, `calloutType`)
- Tags stored as `string[]` in existing `posts.tags` column
- Featured image selected via existing `MediaPickerModal`
- Auto-save draft every 30 seconds using debounced mutation
- Keyboard shortcuts: Ctrl+S to save, Ctrl+Z/Y for undo/redo (in rich text blocks)

