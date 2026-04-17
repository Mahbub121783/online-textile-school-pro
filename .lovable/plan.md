

## Answer to your question

**Yes** — the columns (`bio`, `headline`, `expertise`, `social_links`, `is_public_contributor`, `vote_count`) were added to `user_profiles`, which is the **single profile table for ALL users** (students, instructors, admins, super_admins). Every account already has a row here (auto-created by `handle_new_user` trigger on signup), so every user already has these fields available — they're just empty/default until filled.

However, the **UI to edit these fields is NOT yet wired up anywhere**. Right now:
- ✅ DB columns exist for everyone
- ✅ Public profile page `/contributor/:id` reads them
- ✅ Voting works
- ❌ No form anywhere lets users (students/instructors/admins) actually fill in bio/headline/expertise/social links
- ❌ Admin dashboard has no UI to edit these for any user
- ❌ Student `Profile.tsx` / `SettingsPage.tsx` doesn't expose them
- ❌ Instructor portal has no profile editor
- ❌ `is_public_contributor` toggle isn't surfaced anywhere

So the system is **half-built**: the backend is universal, but the editing surfaces are missing. Let me complete it.

## Plan — Wire profile editing across every role

### 1. Student self-edit — `src/pages/Profile.tsx`
Add a new **"Public Profile"** card section with:
- Headline (single-line input, e.g. "Textile Engineering Student at BUTEX")
- Bio (textarea, 500 char limit, char counter)
- Expertise (tag input — type + Enter to add chips, stored as `text[]`)
- Social links (4 inputs: website, linkedin, github, twitter — stored as JSONB)
- "Show my profile publicly" toggle (`is_public_contributor`)
- Live preview link → opens `/contributor/:id` in new tab
- Save button with optimistic update + toast

### 2. Instructor self-edit — `src/pages/instructor/InstructorDashboard.tsx` (or new `InstructorProfile.tsx`)
Same component reused — instructors get the SAME profile editor (since they share `user_profiles`). Add a prominent "Complete your public profile" card on instructor dashboard if `headline` or `bio` is empty (drives adoption — important so endorsements/profile pages look populated).

### 3. Admin universal editor — `src/pages/admin/AdminUsers.tsx` (or `StudentDetail.tsx`)
Add an **"Edit Public Profile"** section in the existing user manage dialog so admins can:
- Edit any user's bio/headline/expertise/social links
- Force-toggle `is_public_contributor` (e.g. hide spammy profiles)
- Reset `vote_count` (moderation)
- View vote history (last 10 endorsers)

### 4. Reusable component — `src/components/shared/PublicProfileEditor.tsx` (NEW)
Single form component used by all 3 surfaces above (student/instructor/admin). Props: `userId`, `mode: 'self' | 'admin'`. DRY — one source of truth for validation and UI.

### 5. Profile completeness widget update — `src/components/ProfileCompletenessWidget.tsx`
Add `bio` + `headline` to the completeness scoring so users are nudged to fill them in.

### 6. Header/avatar dropdown link — `src/components/layout/Header.tsx`
Add "View public profile" item in the user avatar dropdown for quick access (any role).

### 7. Endorsers list on contributor profile
Small enhancement to `ContributorProfile.tsx`: show last 8 endorser avatars under the vote count (social proof, like LinkedIn).

## Result
- Every user (student, instructor, admin) can edit their own public profile from their dashboard
- Admins can edit any user's public profile from admin panel
- Profile completeness widget nudges users to fill in bio/headline
- Header dropdown gives one-click access to your own public profile
- Single shared component = consistent UX everywhere

## Files Touched
| File | Change |
|---|---|
| `src/components/shared/PublicProfileEditor.tsx` | NEW — reusable form |
| `src/pages/Profile.tsx` | Add Public Profile card |
| `src/pages/instructor/InstructorDashboard.tsx` | Add profile completion card + editor link |
| `src/pages/admin/AdminUsers.tsx` | Add admin edit dialog section |
| `src/components/ProfileCompletenessWidget.tsx` | Score bio + headline |
| `src/components/layout/Header.tsx` | "View public profile" dropdown item |
| `src/pages/contributor/ContributorProfile.tsx` | Add endorser avatars row |

No DB changes needed — schema is already in place from the previous migration.

