## Class Videos — Category-wise Playlist System

A free video library separate from paid courses. Browseable by subject, searchable, with likes & threaded comments. Reuses your existing `SecureMediaPlayer`. Header e notun menu link, homepage e "Our Expert Tutors" er upore section.

---

### 1. Database (Supabase migration — 6 notun table)

**`video_categories`** — subject buckets (Spinning, Dyeing, Weaving…)
- `id, slug (unique), name, description, icon, cover_url, sort_order, is_active, created_at`

**`class_videos`** — main video table
- `id, title, slug (unique), description, thumbnail_url`
- `category_id` → video_categories
- `video_url, video_platform` (`upload` | `drive` | `youtube`)
- `clip_start_seconds` (default 0), `clip_end_seconds` (nullable) — player only plays this range
- `duration_seconds, tags text[]`
- `visibility` enum: `public` | `logged_in` | `paid`
- `required_course_id` (nullable, paid videos er jonno — enrolled hole access)
- `is_published, is_featured, views_count, likes_count, comments_count`
- `uploaded_by, created_at, updated_at`

**`class_video_likes`** — `(video_id, user_id)` unique
**`class_video_comments`** — `id, video_id, user_id, parent_id (nullable, for nested replies), content, likes_count, is_deleted, created_at, updated_at`
**`class_video_comment_likes`** — `(comment_id, user_id)` unique
**`class_video_views`** — `(video_id, user_id|null, viewed_at)` analytics

**RLS**:
- Categories: public read (active), admin/super_admin write
- Videos: read filtered by visibility + auth + enrollment in `required_course_id`; admin write
- Likes/comments: insert/delete only by owner; read public
- Counter triggers: likes_count, comments_count, views_count, comment likes_count
- `updated_at` triggers
- `can_view_class_video()` security-definer helper for visibility logic

---

### 2. Public pages & routing

| Route | Purpose |
|---|---|
| `/class-videos` | Hub: featured + categories grid + global search |
| `/class-videos/category/:slug` | All videos in a subject (newest/popular sort, in-page search) |
| `/class-videos/:slug` | Watch page: player + likes + threaded comments + related |

**Header**: notun "Class Videos" link (desktop + mobile drawer)
**Homepage**: notun `<ClassVideosShowcase />` section `InstructorSpotlight` ("Our Expert Tutors") er **upore** — 6 ta featured/latest video + "View All" button → `/class-videos`

---

### 3. Watch page features

- **Player**: existing `SecureMediaPlayer`-e notun `clipStart`/`clipEnd` props
  - Direct upload: `timeupdate` event diye start e seek + end e pause
  - YouTube: embed URL e `?start=X&end=Y` append
  - Drive: load e seek (end best-effort)
- **Like button**: optimistic update
- **Threaded comments**: 1-level nesting (YouTube style) — top-level + replies, each likeable, owner soft-delete
- **Related**: same category, views diye sort
- **View tracking**: play start e `class_video_views` insert

---

### 4. Admin panel (`/admin/class-videos`)

- Categories CRUD (icon + cover image)
- Videos CRUD with all fields
- Visibility selector per video (Public / Logged-in / Paid + course picker)
- Clip range input (start sec / end sec) with mini preview
- Source picker: Upload (existing `useFileUpload` → R2/Cloudinary) / Drive link / YouTube link
- Featured + publish toggles
- AdminSidebar e "Engagement" group er niche entry

---

### 5. Search

- Hub page: `ilike` on title/description/tags (debounced)
- Category page: in-page client filter

---

### Files to create

```text
src/pages/class-videos/ClassVideosHub.tsx
src/pages/class-videos/ClassVideoCategory.tsx
src/pages/class-videos/ClassVideoWatch.tsx
src/components/class-videos/VideoCard.tsx
src/components/class-videos/CategoryCard.tsx
src/components/class-videos/CommentThread.tsx
src/components/class-videos/CommentItem.tsx
src/components/class-videos/LikeButton.tsx
src/components/features/home/ClassVideosShowcase.tsx
src/pages/admin/AdminClassVideos.tsx
src/pages/admin/AdminClassVideoCategories.tsx
src/hooks/useClassVideos.ts
src/hooks/useVideoComments.ts
```

### Files to edit

- `src/components/media/SecureMediaPlayer.tsx` — `clipStart`/`clipEnd` props enforce
- `src/components/layout/Header.tsx` — "Class Videos" nav link
- `src/components/layout/AdminSidebar.tsx` — admin entries
- `src/pages/Index.tsx` — `<ClassVideosShowcase />` insert (InstructorSpotlight er upore)
- `src/App.tsx` — 3 public + 2 admin route register

---

### Decisions applied (apnar earlier reply theke)

- Default visibility = **public**, admin chaile **logged-in** ba **paid (course-gated)** korte parbe
- Comments & likes: **logged-in users only**
- Sources: **Upload + Drive + YouTube**
- Timestamps: **clip range (start–end seconds)**

Approve korle ami sathe sathe migration apply korbo + sob frontend/admin code build korbo ek shathe.