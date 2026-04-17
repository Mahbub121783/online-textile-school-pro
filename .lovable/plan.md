

## Goal

1. Build an **advanced public Instructor/Writer profile page** at `/profile/:profileId` (or `/contributor/:slug`) accessible from any course/ebook/workshop card, showing bio, all their work, stats, and student voting.
2. Replace the manual text input for `ebooks.author` / `ebooks.sub_writers` (and add co-instructors to courses/workshops) with a **searchable contributor picker** that links real `user_profiles` records.

## DB Changes (one migration)

| Change | Purpose |
|---|---|
| Add `user_profiles.bio TEXT, headline TEXT, expertise TEXT[], social_links JSONB, is_public_contributor BOOL DEFAULT true, vote_count INT DEFAULT 0` | Rich profile fields |
| New table `contributor_votes (id, contributor_id uuid → user_profiles, voter_id uuid, vote_type text default 'upvote', created_at, UNIQUE(contributor_id, voter_id))` + RLS (anyone authenticated can vote once, contributor sees own count) + trigger to update `user_profiles.vote_count` | Voting system |
| New table `content_contributors (id, content_type text CHECK in ('course','ebook','workshop'), content_id uuid, user_id uuid → user_profiles, role text CHECK in ('lead_instructor','co_instructor','author','co_author','reviewer'), sort_order int, UNIQUE(content_type, content_id, user_id))` + RLS (public read, admin/instructor write) | Unified co-author/co-instructor join table — works across all 3 content types without schema duplication |

Existing `instructor_id` / `ebooks.author` / `ebooks.sub_writers` columns stay (back-compat) — new join table is additive and authoritative going forward.

## New Files

| File | Purpose |
|---|---|
| `src/pages/contributor/ContributorProfile.tsx` | Public profile page: hero (avatar, name, headline, vote button + count, social links), tabs: **About** (bio, expertise badges, location), **Courses** (live list via instructor_id + content_contributors), **eBooks**, **Workshops**, **Research Papers** (if any), **Stats** (total students, avg rating, content count). Mobile-responsive. |
| `src/components/shared/ContributorPickerModal.tsx` | Searchable modal — query `user_profiles` by name/username/email, show avatar+role badges, multi-select with role assignment dropdown (lead/co-instructor/author/co-author/reviewer). Replaces manual text inputs. |
| `src/components/shared/ContributorBadge.tsx` | Small reusable avatar+name chip linking to `/contributor/:id` — used on course/ebook/workshop cards & detail pages. |
| `src/hooks/useContributors.ts` | `useContributors(contentType, contentId)` + `useVoteContributor()` mutation. |

## File Edits

| File | Change |
|---|---|
| `src/App.tsx` | Add lazy route `/contributor/:id` → `ContributorProfile` |
| `src/pages/courses/CourseDetail.tsx` | Replace plain instructor text with `<ContributorBadge>` + list co-instructors from `content_contributors` |
| `src/pages/ebooks/EbookDetail.tsx` | Same — show author + sub_writers as clickable badges |
| `src/pages/static/WorkshopDetail.tsx` | Same |
| `src/pages/admin/AdminEbooks.tsx` | Replace `author` text input + `sub_writers` text array with `<ContributorPickerModal>` |
| `src/pages/admin/course-management/CoursesListTab.tsx` (or course form) | Add "Co-Instructors" section using picker |
| `src/pages/admin/AdminWorkshops.tsx` | Add "Co-Instructors" picker alongside existing instructor select |
| `src/pages/dashboard/Profile.tsx` (or SettingsPage) | Let users fill bio/headline/expertise/social_links/is_public_contributor toggle |

## Voting UX
- Logged-in students: click "👍 Endorse" button → inserts into `contributor_votes`, button toggles to "Endorsed ✓", count updates live (React Query invalidation).
- Anonymous: button shows "Login to endorse" → redirects to `/auth/login`.
- One vote per user per contributor (DB unique constraint).

## Result
- Click any instructor/author name anywhere → opens rich profile with all their work
- Students endorse contributors building social proof
- Admins/instructors pick contributors via searchable modal — no typos, real linked profiles
- Co-author/co-instructor support across courses, eBooks, and workshops via single unified table
- Backwards compatible — existing `instructor_id` and `ebooks.author` text still work

