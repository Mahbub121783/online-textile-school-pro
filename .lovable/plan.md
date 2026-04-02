

## Plan: Advanced Support Forum System with Contributor Points & Leaderboard

### What We're Building

A full-featured Support Forum accessible to all authenticated users (students, instructors, admins) with:
- Post creation with categories (auto-suggest existing ones)
- Reactions with dynamic counts on posts and comments
- Threaded comments with replies and reactions
- Forum close/lock by post creator
- Full-text search across all content
- Admin full control (delete, pin, manage categories, remove replies)
- Contributor points system (10pts/post, 5pts/reply, 1pt/react) with Gold/Silver/Bronze ranks
- Real-time leaderboard with admin reward system
- Profile display on all interactions

### Database Changes (1 Migration)

**New Tables:**

```text
forum_categories
├── id (uuid PK)
├── name (text, unique)
├── slug (text, unique)
├── sort_order (int, default 0)
├── created_at (timestamptz)

forum_posts
├── id (uuid PK)
├── user_id (uuid)
├── category_id (uuid FK → forum_categories)
├── title (text)
├── content (text)
├── is_pinned (boolean, default false)
├── is_closed (boolean, default false)
├── view_count (int, default 0)
├── search_vector (tsvector) — generated from title + content
├── created_at, updated_at (timestamptz)

forum_comments
├── id (uuid PK)
├── post_id (uuid FK → forum_posts)
├── parent_id (uuid FK → self, nullable)
├── user_id (uuid)
├── content (text)
├── created_at (timestamptz)

forum_reactions
├── id (uuid PK)
├── user_id (uuid)
├── target_type (text) — 'post' or 'comment'
├── target_id (uuid)
├── emoji (text, default '❤️')
├── created_at (timestamptz)
├── UNIQUE(user_id, target_type, target_id, emoji)

forum_contributor_points
├── id (uuid PK)
├── user_id (uuid)
├── action (text) — 'post', 'reply', 'react'
├── reference_id (uuid)
├── points (int)
├── created_at (timestamptz)

forum_rewards (admin-granted)
├── id (uuid PK)
├── user_id (uuid)
├── granted_by (uuid)
├── points (int)
├── reason (text)
├── created_at (timestamptz)
```

**Search index:** `GIN` index on `forum_posts.search_vector` with trigger to auto-update from `title || content`. Also a DB function `search_forum(query text)` using `ts_rank` for ranked results.

**RLS Policies:**
- Categories: anyone can read, admins can manage
- Posts: authenticated users can read/create, owner+admin can update, admin can delete
- Comments: authenticated can read/create, owner+admin can delete
- Reactions: authenticated can insert/delete own
- Points/Rewards: users read own, admins read all

### New Files

| File | Purpose |
|------|---------|
| `src/pages/forum/ForumHome.tsx` | Main forum page — category filter tabs, search bar, post list with reactions/comment counts, contributor badges |
| `src/pages/forum/ForumPost.tsx` | Single post view — full content, threaded comments with replies, reactions, close button for owner |
| `src/pages/forum/CreatePost.tsx` | New post form — title, content (rich text), category picker with auto-suggest |
| `src/pages/admin/AdminForum.tsx` | Admin forum management — category CRUD, pinned posts, delete posts/comments, leaderboard view, reward granting |

### Edited Files

| File | Changes |
|------|---------|
| `src/App.tsx` | Add routes: `/forum`, `/forum/:postId`, `/forum/new`, `/admin/forum` |
| `src/components/layout/Header.tsx` | Add "Forum" to nav links |
| `src/components/layout/DashboardSidebar.tsx` | Add "Forum" nav item |
| `src/components/layout/InstructorSidebar.tsx` | Add "Forum" nav item |
| `src/components/layout/AdminSidebar.tsx` | Add "Forum" nav item |
| `src/hooks/useRealtime.ts` | Add forum tables to realtime subscriptions |

### Key Features

**Advanced Search**
- PostgreSQL full-text search with `tsvector` + `GIN` index
- Every word in title and content is indexed
- Client-side instant filter + server-side ranked results
- Search highlights matching terms

**Contributor Points & Leaderboard**
- Points auto-inserted via client-side logic after post/reply/react
- Aggregated leaderboard query: SUM points from `forum_contributor_points` + `forum_rewards`
- Top 3 get Gold 🥇, Silver 🥈, Bronze 🥉 badges displayed on their profile avatar in forum
- Each user's profile card shows total contributor points
- Admin sees full leaderboard with reward button

**Real-time**
- Realtime subscriptions on `forum_posts`, `forum_comments`, `forum_reactions` for live updates
- New comments/reactions appear instantly without refresh

**Admin Controls**
- Pin/unpin posts
- Delete any post or comment
- Create/edit/delete categories
- View full contributor leaderboard
- Grant bonus reward points to any user with reason

### Implementation Steps

1. **Migration** — Create all 6 tables, search index, trigger, RLS policies
2. **ForumHome.tsx** — Category tabs, search, post cards with user profiles, reaction counts, comment counts, contributor badges
3. **ForumPost.tsx** — Post detail with threaded comments, reactions, close/lock, admin controls
4. **CreatePost.tsx** — Form with category auto-suggest from existing categories
5. **AdminForum.tsx** — Category management, leaderboard, rewards, moderation
6. **Wire up** — Routes, sidebar links, realtime subscriptions

Total: 1 migration, 4 new files, 6 edited files.

