

# Fix EduMail: Sender Address, Inbox Sync & Password Management

## Problems Identified

1. **Wrong sender address**: `edumail-client` calls `send-smtp-email` with `from_override` in metadata, but `send-smtp-email` ignores it entirely — it always uses the global `smtp_from_email` (likely `info@onlinetextileschool.com`). The fix: `send-smtp-email` must read `metadata.from_override` and use it as the SMTP `from` field.

2. **Inbox not receiving external emails**: The platform only stores locally-created `edumail_messages` records. When someone external sends an email to `md_mahbubul_alam_033@onlinetextileschool.com`, it lands in the cPanel mailbox but the platform never fetches it. Need an IMAP fetch mechanism.

3. **EduMail page changes**: Remove "Open Webmail" link. Add auto-generated password display (already generated on approve). Add password change with 15-day cooldown. Sync password changes to cPanel and update DB.

---

## Plan

### Step 1 — Fix sender address in `send-smtp-email`
**File**: `supabase/functions/send-smtp-email/index.ts`

In the SMTP `send()` call (line ~385-397), check if `metadata?.from_override` exists. If so, use that as the `from` address instead of `cfg.smtp_from_email`. This makes EduMail sends appear from the user's institutional email.

### Step 2 — Also send via user's own SMTP credentials
**File**: `supabase/functions/edumail-client/index.ts`

Instead of delegating to `send-smtp-email` (which uses the platform's global SMTP account), send directly using the user's own cPanel SMTP credentials (`mail.onlinetextileschool.com:465` with the user's email + stored password). This ensures the email truly originates from the user's mailbox. Fall back to the override approach if direct SMTP fails.

### Step 3 — Add IMAP inbox sync via new edge function
**New file**: `supabase/functions/edumail-imap-sync/index.ts`

Create an edge function that:
- Accepts a user ID (or runs for all active email users)
- Connects to `mail.onlinetextileschool.com:993` via IMAP using the user's stored credentials
- Fetches new messages from the INBOX folder
- Inserts them into `edumail_messages` with `folder = 'inbox'`
- Tracks last-synced UID to avoid duplicates

The user's Mail page will call this on load (or via a "Refresh" button) to pull new emails.

### Step 4 — Update EduMail page (password management, remove webmail)
**File**: `src/pages/dashboard/EduMailPage.tsx`

- Remove the "Open Webmail" link (lines 155-165)
- Show current password (masked, with reveal toggle) from `emailReq.current_password`
- Add "Change Password" button with 15-day cooldown enforcement:
  - Check `last_password_reset_at` — if < 15 days ago, disable button with countdown
  - On click: call `cpanel-email-provisioner` with `action: 'change-password'` (new action)
  - Auto-generate new password, update cPanel, update DB

### Step 5 — Add user-initiated password change action to provisioner
**File**: `supabase/functions/cpanel-email-provisioner/index.ts`

Add a new `action: 'change-password'` that:
- Can be called by the email owner (not just admin)
- Validates 15-day cooldown from `last_password_reset_at`
- Generates new password, updates cPanel via UAPI
- Updates `current_password` and `last_password_reset_at` in DB
- Admin reset-password action also updates `last_password_reset_at` (already does)

### Step 6 — Redeploy edge functions
Deploy: `send-smtp-email`, `edumail-client`, `cpanel-email-provisioner`, `edumail-imap-sync`

---

## Technical Details

- IMAP in Deno: Use `https://deno.land/x/imap/` or raw TLS socket with IMAP commands
- Password stored in `institutional_email_requests.current_password` column (already exists)
- 15-day cooldown: compare `last_password_reset_at` + 15 days vs `now()`
- The `from_override` fix in `send-smtp-email` is a 3-line change checking `metadata?.from_override`
- For direct SMTP sending from user accounts, credentials are: email = `requested_email`, password = `current_password`, server = `mail.onlinetextileschool.com`, port = 465

