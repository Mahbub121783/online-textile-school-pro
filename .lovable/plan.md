

# Gmail-Style Internal Mail System (EduMail Inbox)

## Overview

Build a full-featured internal email client within the platform, powered by cPanel webmail (IMAP/SMTP) via an edge function proxy. Users with approved institutional emails get a dedicated multi-tab mail dashboard (Inbox, Sent, Drafts, Trash). Admin gets a similar mail dashboard plus the existing compose system. Storage quota reduced to 200MB.

## Architecture

The system uses the cPanel UAPI to interact with the actual mailboxes on `mail.onlinetextileschool.com`. A new edge function (`edumail-client`) acts as a proxy between the frontend and cPanel's webmail APIs, authenticating with the user's stored credentials.

```text
Browser (React)  →  edumail-client (Edge Function)  →  cPanel UAPI
                                                        ├── Email/list_pops_with_disk
                                                        ├── Webmail IMAP via cPanel
                                                        └── SMTP send
```

**Key decision**: Since cPanel UAPI doesn't expose a full IMAP client API, the edge function will connect directly to the IMAP server (`mail.onlinetextileschool.com:993`) using a Deno IMAP library and SMTP (`port 465`) for sending. User credentials are already stored in `institutional_email_requests.current_password`.

## What Will Be Built

### 1. Database Migration
- New table `edumail_messages` — local cache/store for internal messages:
  - `id`, `owner_id` (user_id), `folder` (inbox/sent/drafts/trash), `from_email`, `to_emails` (text[]), `cc_emails` (text[]), `bcc_emails` (text[]), `subject`, `body_html`, `body_text`, `is_read`, `is_starred`, `has_attachments`, `attachments` (jsonb[]), `in_reply_to` (uuid ref), `thread_id`, `signature_used`, `recalled_at`, `created_at`, `sent_at`, `updated_at`
- New table `edumail_signatures` — user email signatures:
  - `id`, `user_id`, `name`, `body_html`, `is_default`, `created_at`
- New table `edumail_contacts` — address book auto-populated from platform users:
  - `id`, `user_id`, `email`, `display_name`, `created_at`
- Update `institutional_email_requests` default `email_quota_mb` from 512 to 200
- Update existing approved rows quota to 200

### 2. Edge Function — `edumail-client`
New edge function handling all mail operations:
- **`list-messages`** — Fetch messages from a folder with pagination, search
- **`get-message`** — Get full message content by ID
- **`send-message`** — Compose and send via SMTP (port 465 SSL), save to Sent, store attachments
- **`save-draft`** — Save/update draft message
- **`move-message`** — Move between folders (trash, archive)
- **`delete-message`** — Permanently delete
- **`mark-read`** / **`mark-starred`** — Toggle flags
- **`recall-message`** — Mark as recalled (soft recall for internal messages only)
- **`upload-attachment`** — Upload to Cloudflare R2 (files) or Cloudinary (images), return URL
- **`search`** — Full-text search across messages

The function retrieves the user's institutional email credentials from `institutional_email_requests` table, then operates on their actual mailbox.

### 3. Student/Instructor EduMail Page — Complete Rewrite
Replace the current `EduMailPage.tsx` status page with a full mail client:
- **Sidebar**: Compose button, Inbox (with unread count), Sent, Drafts, Trash, Starred
- **Message List**: Sender, subject preview, date, read/unread indicator, star toggle, checkbox for bulk actions
- **Message View**: Full HTML rendering, reply/forward/delete actions, attachment downloads
- **Compose Modal/Page**: Rich text editor (bold, italic, underline, font size, tables, lists, text color), To/CC/BCC fields with autocomplete from platform users, subject, attachments (drag-drop), signature selector, send/save-draft
- **Signature Manager**: Create/edit/delete signatures with rich text, set default
- **Email Recall**: For internal messages sent within last 5 minutes, option to recall
- **Search**: Search bar with filters (from, to, date range, has attachments)
- Keep the existing account info (email address, validity, IMAP/SMTP settings) in a collapsible "Account Settings" section

### 4. Admin Mail Dashboard
New page `/admin/mail` with the same full mail client for admin's institutional email:
- Inbox, Sent, Drafts, Trash — same UI as student version
- Additional "Compose to Students" quick action using the existing compose system
- Admin can view/manage their own `@onlinetextileschool.com` mailbox

### 5. Admin Compose Email — Upgrade
Enhance `AdminEmailCompose.tsx`:
- Replace plain `<Textarea>` with the same rich text editor (bold, italic, tables, font size, attachments)
- Add CC/BCC fields
- Add signature support
- Keep existing template/placeholder system

### 6. Rich Text Editor Component
Create `src/components/mail/RichTextEditor.tsx`:
- Toolbar: Bold, Italic, Underline, Strikethrough, Font Size (S/M/L/XL), Text Color, Highlight
- Paragraph formatting: Headings, Bullet/Numbered lists, Blockquote
- Insert: Table (rows x cols), Horizontal rule, Link, Image (from Cloudinary)
- Attachment button (files via R2, images via Cloudinary)
- Uses `contentEditable` div with `document.execCommand` or a lightweight lib like TipTap

### 7. Navigation & Routing
- Add `/dashboard/mail` route (rename current `/dashboard/edumail` to account settings subsection)
- Add `/admin/mail` route for admin mailbox
- Update `DashboardSidebar.tsx` — rename "EduMail" to "Mail" with mail icon, link to `/dashboard/mail`
- Update `InstructorSidebar.tsx` — same
- Update `AdminSidebar.tsx` — add "Mail" item linking to `/admin/mail`
- Keep `/dashboard/edumail` as account/settings for the institutional email

### 8. Gmail Sync Consideration
Gmail sync via OAuth requires a Google Cloud project with Gmail API access. This is complex and costly. Instead, the pragmatic approach:
- Show a "Forward to Gmail" setup card where users can configure auto-forwarding from their institutional email to their personal Gmail via cPanel's email forwarder API (`Email/add_forwarder`)
- This gives them all institutional emails in their Gmail inbox automatically

## Files to Create
1. `supabase/migrations/xxx_edumail_tables.sql` — New tables + quota update
2. `supabase/functions/edumail-client/index.ts` — Mail proxy edge function
3. `src/components/mail/RichTextEditor.tsx` — Rich text editor component
4. `src/components/mail/ComposeModal.tsx` — Compose email modal
5. `src/components/mail/MessageList.tsx` — Message list view
6. `src/components/mail/MessageView.tsx` — Full message reader
7. `src/components/mail/MailSidebar.tsx` — Folder navigation sidebar
8. `src/components/mail/SignatureManager.tsx` — Signature CRUD
9. `src/components/mail/AttachmentUploader.tsx` — File upload component
10. `src/pages/dashboard/MailPage.tsx` — Student/instructor mail client
11. `src/pages/admin/AdminMailPage.tsx` — Admin mail client

## Files to Modify
1. `src/App.tsx` — Add mail routes
2. `src/components/layout/DashboardSidebar.tsx` — Update nav
3. `src/components/layout/InstructorSidebar.tsx` — Update nav
4. `src/components/layout/AdminSidebar.tsx` — Add Mail item
5. `src/pages/dashboard/EduMailPage.tsx` — Refactor to account settings only
6. `src/pages/admin/AdminEmailCompose.tsx` — Upgrade with rich editor
7. `src/integrations/supabase/types.ts` — Add new table types

## Technical Details
- IMAP connection in edge function using Deno-compatible IMAP client
- SMTP sending via `nodemailer`-equivalent for Deno (or raw SMTP socket)
- Attachments: images → Cloudinary, files → Cloudflare R2 (using existing `useFileUpload` pattern)
- Email quota: 200MB per user (down from 512MB)
- Internal message recall: only works for messages between `@onlinetextileschool.com` addresses, within 5-minute window
- Rich text: TipTap editor (lightweight, extensible, works in React)
- Auto-forwarding to Gmail: cPanel `Email/add_forwarder` UAPI endpoint

