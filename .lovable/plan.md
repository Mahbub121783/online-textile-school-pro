
# Practice Exam — Student-Friendly + Competitive Upgrade

Goal: Students sohoje pabe, exam ta competitive feel dibe (JEE/Olympiad style), timer & state churi-proof but friendly (warning only, resume allowed), result page e gamification.

---

## 1. Discoverability — Students kothay pabe

**A. Dedicated landing page** `/practice` (already exists as `PracticeHome.tsx`) — upgrade to a hero-styled competitive landing:
- Boro hero: "Practice Arena — Test Your Edge"
- Live stats strip: total questions, students online, top scorer today
- Subject grid cards (icon + question count + difficulty badge)
- "Quick Start" CTA (random 10-question sprint)
- Recent attempts + leaderboard preview

**B. Homepage Hero CTA**
- `src/components/features/home/` e notun `PracticeArenaCTA.tsx` section — boro gradient banner with "Start Practicing → /practice"
- Mount kora hobe `src/pages/Index.tsx` e (Featured Courses er por)

**C. Header nav e "Practice" link** add (optional but recommended for visibility) — `Header.tsx` desktop nav + `BottomNav.tsx` mobile.

---

## 2. Secure Resumable Timer (Churi-proof)

Already server-side `started_at` based — bhalo. Upgrade:

- **Server is source of truth**: timer always recomputed from `started_at + time_limit_seconds - now()` on every mount. Local clock manipulate korle kichu hobe na.
- **Heartbeat ping** every 20s → updates `qb_exam_sessions.last_heartbeat_at` (new column). Server-side: jodi heartbeat `time_limit + 60s` peruye jay tobe `qb_submit_exam` auto-trigger via cron OR lazy-submit on next access.
- **Tab close / refresh / browser crash**: re-open korle session resume hobe with correct remaining time, but warning count +1 (see §3).
- **localStorage backup of answers** (per session) — accidental refresh hole answers hariye jabe na.

---

## 3. Soft Anti-Cheat (Warnings Only)

New table `qb_exam_violations` (session_id, type, occurred_at, metadata).

Detect & log these events client-side, push to server:
- `tab_blur` / `visibility_hidden` (tab switch, minimize)
- `window_blur` (alt-tab)
- `fullscreen_exit` (if fullscreen mode active)
- `copy` / `paste` / `right_click` attempts (blocked + logged)
- `session_resumed` (after refresh/crash)
- `devtools_opened` (best-effort heuristic)

UI behavior (friendly, not punishing):
- Top of exam shows **"Integrity: ⚠ 0 warnings"** counter
- On each violation: toast banner "Warning #N — please stay on this tab. Your activity is being recorded."
- **No auto-submit ever** (per user choice) — exam continues
- Result page shows full integrity report ("3 tab switches, 1 paste attempt") — visible to admin too
- Admin dashboard violation analytics

---

## 4. Fullscreen Focused Exam UI

Upgrade `PracticeExam.tsx`:

- **"Enter Focus Mode" button on start** → `requestFullscreen()`, hides all chrome (header, footer, sidebar)
- Distraction-free shell: only question + options + timer + palette
- Large, bold timer (top-right), color shifts: green → amber (<5min) → red pulse (<1min)
- Smooth question transitions (framer-motion fade + slide)
- Keyboard shortcuts: `1-9` select option, `→/←` next/prev, `F` flag, `Enter` submit
- Progress ring instead of bar
- Auto-save indicator ("Saved ✓" subtle)
- Mobile: sticky bottom action bar (Prev / Flag / Next), palette in bottom sheet
- Dark exam theme (always dark inside exam regardless of site theme) — pure focus

---

## 5. Gamified Result Page

Upgrade `PracticeResult.tsx`:

- **Hero score reveal animation** (count-up animation, framer-motion)
- Big circular score ring with grade badge (S/A/B/C/D)
- **XP earned** card: `+score × 10 XP` with streak bonus
- **Rank reveal**: "You're #12 out of 547 today" (animated)
- **Streak counter**: "🔥 5-day streak"
- **Badges unlocked** (e.g. "Speed Demon" — finished in <50% time, "Perfectionist" — 100%, "Warrior" — 10 exams done)
- Time-per-question chart (recharts)
- Subject mastery progress bar update animation
- Question-by-question review accordion (correct/wrong/explanation)
- **Confetti** on >80% score
- Share card generator (download as PNG: "I scored 92% on Physics Practice")
- CTAs: "Try Again" / "Next Subject" / "View Leaderboard"

XP & badge tables (new):
- `qb_user_stats` (user_id, total_xp, current_streak, longest_streak, last_practice_date, exams_taken)
- `qb_badges` (key, name, description, icon, criteria_jsonb)
- `qb_user_badges` (user_id, badge_key, earned_at)

XP awarded inside `qb_submit_exam` RPC (atomic update).

---

## 6. Admin Visibility

- AdminQuestionBank → notun "Live Sessions" tab: ongoing exams + violation feed
- Per-attempt detail modal showing violation timeline
- Aggregate analytics: avg violations per subject, suspicious users (>10 violations)

---

## Technical Sections

### DB migrations
1. Alter `qb_exam_sessions`: add `last_heartbeat_at TIMESTAMPTZ`, `violation_count INT DEFAULT 0`, `focus_mode_used BOOLEAN DEFAULT false`
2. Create `qb_exam_violations` table + RLS (student insert own, admin read all)
3. Create `qb_user_stats`, `qb_badges`, `qb_user_badges` + RLS
4. RPC `qb_log_violation(_session_id, _type, _metadata)`
5. RPC `qb_heartbeat(_session_id)`
6. Update `qb_submit_exam`: award XP, update streak, evaluate badges
7. Seed default badges (8-10 starter badges)

### Frontend files
- **New**: `src/components/practice/FocusModeShell.tsx`, `IntegrityBanner.tsx`, `ResultHeroReveal.tsx`, `BadgeUnlockModal.tsx`, `ShareScoreCard.tsx`, `useExamIntegrity.ts` hook, `useExamHeartbeat.ts` hook
- **New**: `src/components/features/home/PracticeArenaCTA.tsx`
- **Edit**: `PracticeHome.tsx` (hero+stats+grid), `PracticeExam.tsx` (focus mode, integrity, keyboard, animations, localStorage backup), `PracticeResult.tsx` (full gamification), `Index.tsx` (mount CTA), `Header.tsx` + `BottomNav.tsx` (Practice link), `AdminQuestionBank.tsx` (Live Sessions tab)

### Libraries (already installed): framer-motion, recharts, canvas-confetti (verify) , html-to-image (for share card — may need install)

### Mobile responsiveness
- Focus mode adapts: full-screen, swipe between questions, bottom sheet palette
- Result page stacks vertically, share card uses native Web Share API on mobile

---

## Out of scope (this iteration)
- Hard-mode auto-submit (per your choice)
- Proctoring with camera/AI
- Paid premium exams

