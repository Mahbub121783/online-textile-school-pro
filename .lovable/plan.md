

## Problem
Inbox messages render raw MIME (boundary markers like `--000000000000f4fc29064fb253d0`, `Content-Type:` headers, and the IMAP trailer `A0004 OK Fetch completed`) instead of clean message body. Root cause is in `supabase/functions/edumail-imap-sync/index.ts` — the parser does no real MIME parsing.

## Fix (two parts)

### 1. Rewrite MIME parsing in `edumail-imap-sync`
Replace `parseEmailFromFetch` + the IMAP read loop with proper handling:

- **Strip IMAP envelope**: remove the leading `* N FETCH (BODY[] {SIZE}\r\n` literal header and the trailing `)\r\nA#### OK Fetch completed...` so only the raw RFC822 message remains.
- **Parse headers vs body** correctly (split on first `\r\n\r\n` of the RFC822 message only).
- **Decode MIME-encoded headers** (`=?utf-8?Q?...?=` / `=?utf-8?B?...?=`) for Subject/From/To.
- **Walk multipart bodies**:
  - Read `Content-Type: multipart/...; boundary="..."`.
  - Split parts on `--boundary`, recursively pick `text/html` (preferred) else `text/plain`.
  - Honor `Content-Transfer-Encoding`: decode `quoted-printable` and `base64`.
  - Honor `charset` (decode UTF-8 / latin1 via `TextDecoder`).
- **Detect attachments**: parts with `Content-Disposition: attachment` → record name/size in `attachments` JSON, set `has_attachments`.
- **Fallback**: if no usable text part, store empty body (do NOT dump raw MIME).

### 2. Sanitize on the client (defense in depth)
In `src/components/mail/MessageView.tsx`:
- If `body_html` is empty, render `body_text` inside `<pre className="whitespace-pre-wrap">` — not raw HTML.
- Strip any leftover lines that look like IMAP trailers (`A\d{4} OK ...`) or bare MIME boundary lines (`^--[0-9a-f]{20,}`) before render — safety net for already-synced bad rows.

### 3. Re-sync existing bad rows (optional, safe)
Add a tiny one-shot button on the mail page (or just rely on next sync) — existing rows in `edumail_messages` already contain the garbled body. Easiest: a "Re-parse inbox" action that deletes inbox rows and resets `last_synced_uid = 0` so the next sync re-pulls them with the fixed parser. Keep this off by default; just document it.

## Files
| File | Change |
|---|---|
| `supabase/functions/edumail-imap-sync/index.ts` | Real MIME parser: strip IMAP envelope, decode encoded-words, walk multipart boundaries, decode QP/base64, extract attachments |
| `src/components/mail/MessageView.tsx` | Render plain text in `<pre>` when no HTML; strip stray IMAP trailers/boundary lines as safety net |

## Result
Inbox shows clean message body (e.g. just "Test mail") with no boundary markers, no `Content-Type` lines, and no `A0004 OK Fetch completed` trailer. HTML emails render properly; plain-text emails render as readable text; attachments appear in the attachments strip.

