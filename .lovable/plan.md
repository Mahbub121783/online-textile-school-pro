# Fix: Workshop "Start" button not showing for registered students

## Root causes (deeply checked)

I inspected the database, RLS policies, and both the student-facing pages (`WorkshopDetail`, `MyWorkshopsPage`).

### Cause 1 — Status never auto-flips to `ongoing` / `completed` (the main bug)
Workshops in DB:
- *"Industrial 3D Design Process with CLO3D"* — start = today 20:30, status = **`published`**, has meet_link, 129 registrations.
- *"vibe Coding Masterclass"* — past, status = `ongoing` (admin manually flipped it), has meet_link.

Student-side "Start Workshop" button shows only when:
```
isLive = (status === 'ongoing') OR (start time passed AND status not completed/cancelled)
```

So when the admin uploads a meet link but **forgets to manually change status from `published` → `ongoing`**, the only thing keeping the button visible is "start time has passed". Until then, students see nothing — exactly what they're complaining about.

There is **no scheduled job, trigger, or backend logic** that flips workshop status automatically. It's 100% manual. Most admins never do it on time.

### Cause 2 — Local-time parsing is fragile
`new Date(\`${start_date}T${start_time}\`)` parses as the **viewer's local timezone**. Since `workshops.start_time` is stored as `time without time zone` (no tz attached), a Bangladesh-set 20:30 will resolve to 20:30 in the viewer's machine clock, not 20:30 BD time. For students in a different tz, "isLive" calculation drifts. Also, `Date('YYYY-MM-DDTHH:MM')` (no `:SS`) is parsed inconsistently across browsers (Safari treats it as UTC, Chrome as local).

### Cause 3 — `meet_link` is publicly readable (security leak)
Current RLS: `Anyone can view published workshops` with `status <> 'draft'` — this includes the `meet_link` column. Any unauthenticated visitor can scrape every workshop's Google Meet link. Should be visible only to registered users + admin/instructor.

### Cause 4 — No upper time bound on "Live"
Once start time passes, `isLive` stays true forever (until admin manually flips to `completed`). Workshops display "● LIVE" days/weeks later.

### Cause 5 — Minor: `MyWorkshopsPage` doesn't show meet link if status is still `published` and time hasn't quite arrived
Students who registered for today's 20:30 workshop will only see the Start button at exactly 20:30 + admin-manual-flip — confusing because tickets, emails and reminders all say "join at 20:30".

---

## Plan

### 1. Auto-flip workshop status with a database trigger + scheduled function
Add a `pg_cron` job that runs every 5 minutes and updates:
- `published` → `ongoing` when `start_date + start_time` is in the past AND `(end_date + end_time)` is in the future.
- `ongoing` → `completed` when `end_date + end_time` has passed.

This way the admin never needs to click anything; status reflects reality automatically. Plus a manual override remains possible (admin can still set it earlier/later).

### 2. Make student-side "isLive" logic timezone-correct
Use a single computed window stored on the workshop row at insert/update time:
- Add two computed `timestamptz` columns: `start_at`, `end_at` populated from `start_date + start_time` interpreted in **Asia/Dhaka** (via a trigger using `(start_date + start_time) AT TIME ZONE 'Asia/Dhaka'`).
- Front-end uses these already-tz-correct timestamps to compute `isLive` — no more local-tz drift.

### 3. Show Start button as soon as `start_at - 10 minutes` arrives (early-join window)
Update `WorkshopDetail` and `MyWorkshopsPage`:
```
const now = Date.now();
const isLive = (status === 'ongoing')
            || (now >= start_at_ms - 10*60*1000 && now <= end_at_ms + 30*60*1000 && status !== 'cancelled');
```
Students get a 10-min early-join window and a 30-min grace period after end. After that the button auto-disappears.

### 4. Lock down `meet_link` (security)
- Drop the broad public SELECT policy on `workshops`.
- Create a `workshops_public` view that excludes `meet_link` for unauthenticated visitors.
- Tighten RLS so `meet_link` column is only accessible to: admins, the assigned instructor, and users with a row in `workshop_registrations` for that workshop (`status = 'registered'`).
- Use Postgres column-level grants so even a SELECT * from anon/registered-elsewhere users hides the link.

### 5. Admin UX improvements
- In Admin → Workshops list, add a small badge: **"⚠ Status mismatch — should be ongoing"** when start time has passed but status is still `published`. Plus a one-click "Mark Ongoing" button.
- Block publishing a workshop that has start time but no `meet_link` (prevents the empty-link variant of this bug). Allow draft saves without a link.

### 6. Fire pre-workshop reminder email (bonus)
Use the same cron job to send a reminder email 30 minutes before start to all `registered` users with a clickable join link. Many students complain *because* they didn't know the workshop went live.

---

## Files touched

- `supabase/migrations/<ts>_workshop_auto_status.sql` — `start_at`/`end_at` columns + trigger, pg_cron jobs for status flip and reminders, tightened RLS for `meet_link`, public view.
- `src/pages/static/WorkshopDetail.tsx` — use `start_at`/`end_at` + early-join window.
- `src/pages/dashboard/MyWorkshopsPage.tsx` — same updated `isLive` logic + always show countdown.
- `src/pages/admin/AdminWorkshops.tsx` — status mismatch badge, "Mark Ongoing" quick action, validation that prevents publishing without meet_link.
- `supabase/functions/send-smtp-email` — already exists, no change; cron just calls it.
- (new) `supabase/functions/workshop-reminder-cron/index.ts` — sends reminders, called by cron.

## What won't change

- Registration flow (already correct — RLS + insert work fine).
- Materials download, registration number, emails on registration.
- Workshop visibility for unauthenticated browsing.

Approve and I'll implement all six steps.
