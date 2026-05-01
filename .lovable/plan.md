## Class Videos — Category Playlist System

A dedicated free video library, separate from paid courses. Browseable by category/subject, searchable, with likes and threaded comments. Reuses the existing `SecureMediaPlayer` (already supports YouTube, Drive, direct upload).

---

### 1. Database (new migration)

**`video_categories`** — subject buckets (Spinning, Dyeing, Weaving…)
- `id`, `slug` (unique), `name`, `description`, `icon`, `cover_url`, `sort_order`, `is_active`, `created_at`

**`class_videos`** — the videos themselves
- `id`, `title`, `slug`, `description`, `thumbnail_url`
- `category_id` → video_categories
- `video_url`, `video_platform` (`upload` | `drive` | `youtube`)
- `clip_start_seconds` int default 0, `clip_end_seconds` int nullable — player only plays this range
- `duration_seconds`, `tags` text[]
- `visibility` enum: `public` | `logged_in` | `paid` (admin-controlled per video)
- `required_course_id` nullable (for `paid` visibility — grants access if user is enrolled)
- `is_published`, `is_featured`, `views_count`, `likes_count`, `comments_count`
- `uploaded_by`, `created_at`, `updated_at`

**`class_video_likes`** — `(video_id, user_id)` unique
**`class_video_comments`** — `id`, `video_id`, `user_id`, `parent_id` (nullable, for nested replies), `content`, `likes_count`, `created_at`, `is_deleted`
**`class_video_comment_likes`** — `(comment_id, user_id)` unique
**`class_video_views`** — `(video_id, user_id|null, viewed_at)` for analytics + view counting

**RLS**
- Categories: public read, admin write
- Videos: read filtered by `visibility` + auth state + enrollment in `required_course_id`; admin/instructor write
- Likes & comments: insert/update/delete only by owner & only if user can read the video; read public
- Counters maintained by triggers (likes_count, comments_count, views_count)

---

### 2. Public Pages & Routing

| Route | Purpose |
|---|---|
| `/class-videos` | Hub: featured + all categories grid + global search |
| `/class-videos/category/:slug` | All videos in a subject (filters: newest/popular, search within) |
| `/class-videos/:slug` | Watch page: player + description + likes + threaded comments + related videos |

Header menu: new top-level link **"Class Videos"** (desktop + mobile drawer).

Homepage: new section **"Free Class Videos"** placed right under `InstructorSpotlight` ("Our Expert Tutors") — shows 6 latest/featured videos + **View All** button → `/class-videos`.

---

### 3. Watch page features

- **Player**: reuses `SecureMediaPlayer`. New prop `clipStart`/`clipEnd` — auto-seeks to `clipStart` on load and pauses at `clipEnd`. For direct uploads, enforced via `timeupdate`. For YouTube embeds, append `?start=X&end=Y` to the embed URL. For Drive, seek on load (end-clip best-effort).
- **Like button** with optimistic update.
- **Threaded comments** (1 level of nesting like YouTube): top-level + replies. Each comment can be liked. Author can delete (soft).
- **Related**: same category, sorted by views.
- **View tracking**: insert into `class_video_views` on play start.

---

### 4. Admin

New admin page `/admin/class-videos`:
- Categories CRUD (with icon + cover)
- Videos CRUD with fields above
- Per-video visibility selector (Public / Logged-in / Paid)
- Clip range inputs (start sec / end sec) with a small preview
- Source picker (Upload via existing `useFileUpload` → R2 / Drive link / YouTube link)
- Featured + publish toggles, drag-to-reorder

Sidebar entry under "Engagement" group.

---

### 5. Search

- Client-side filter on category pages (debounced)
- Global hub page uses ilike on `title`, `description`, `tags` against `class_videos`. (No new pg_search index needed at this scale — can add later.)

---

### 6. Files to create

```text
src/pages/class-videos/ClassVideosHub.tsx
src/pages/class-videos/ClassVideoCategory.tsx
src/pages/class-videos/ClassVideoWatch.tsx
src/components/class-videos/VideoCard.tsx
src/components/class-videos/CategoryCard.tsx
src/components/class-videos/CommentThread.tsx
src/components/class-videos/CommentItem.tsx
src/components/class-videos/LikeButton.tsx
src/components/features/home/ClassVideosShowcase.tsx   (homepage section)
src/pages/admin/AdminClassVideos.tsx
src/pages/admin/AdminClassVideoCategories.tsx
src/hooks/useClassVideos.ts
src/hooks/useVideoComments.ts
supabase/migrations/<timestamp>_class_videos.sql
```

### 7. Files to edit

- `src/components/media/SecureMediaPlayer.tsx` — add `clipStart`/`clipEnd` props + enforcement
- `src/components/layout/Header.tsx` — add "Class Videos" nav link
- `src/components/layout/AdminSidebar.tsx` — add admin entries
- `src/pages/Index.tsx` — insert `<ClassVideosShowcase />` under `InstructorSpotlight`
- `src/App.tsx` — register 3 public routes + 2 admin routes

---

### Summary of decisions applied
- Default visibility = **public**, admin can switch any video to **logged-in only** or **paid (course-gated)**
- Comments & likes require login
- Sources: Upload + Drive + YouTube (Vimeo skipped)
- Timestamps = clip range (start–end seconds)
