# Workshop reminder system — auto + manual

Reuses the existing `send-smtp-email` function and the already-configured `workshop_live_link` template (no new email infrastructure needed).

## What this delivers

1. **Automatic** — Every registered student receives an email **30 minutes before** the workshop starts, containing the Meet link, exact date/time (Asia/Dhaka), and workshop title. Students also get an in-app bell notification.
2. **Manual** — Admin can click **"Send reminder now"** from the workshop card at any time to immediately blast all registered students.
3. **No-duplicate guarantee** — A `reminder_sent_at` flag prevents the cron from firing twice for the same workshop.

## Implementation steps

### 1. Migration
- Add column `workshops.reminder_sent_at timestamptz` (nullable).
- Schedule pg_cron `workshop-reminder-cron` every 5 minutes calling the new edge function.

### 2. New edge function `workshop-reminder-cron`
- **Cron mode** (no body): finds all workshops with
  `meet_link IS NOT NULL`, `start_at` between `now()` and `now() + 35 min`, `reminder_sent_at IS NULL`, status in `published`/`ongoing`. Sends email to all `registered` students, sets `reminder_sent_at = now()`, and inserts a `notifications` row for each user.
- **Manual mode** (`POST { workshop_id: "uuid" }`): same logic for one workshop, ignoring the time window and `reminder_sent_at` (admin can re-send).
- Uses Asia/Dhaka local time formatting in the email body.

### 3. Admin UI
- In `AdminWorkshops.tsx`, add a green **"Send reminder"** button (envelope icon) next to existing actions for workshops that have a meet link. Confirm dialog → invoke `workshop-reminder-cron` with `workshop_id`. Toast success with `sent/total` count.
- Show a small badge `Reminder sent` if `reminder_sent_at` is set.

### 4. Email content (already exists)
Uses existing template `workshop_live_link` with placeholders:
- `user_name`, `workshop_title`, `start_time` (formatted Asia/Dhaka), `meet_link`.

No template changes needed unless you want me to also update its design.

## Files

- `supabase/migrations/<ts>_workshop_reminders.sql` — column + cron job
- `supabase/functions/workshop-reminder-cron/index.ts` — new function
- `src/pages/admin/AdminWorkshops.tsx` — "Send reminder" button + status badge

## Approve to implement.
