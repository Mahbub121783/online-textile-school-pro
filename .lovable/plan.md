
## What’s actually wrong

Do I know what the issue is? Yes.

This is most likely **not the parser code alone anymore**. The key problem is that the app is still showing **old, already-saved bad inbox rows**.

Why I’m confident:
- `MailPage.tsx` still calls `edumail-imap-sync` with no reset payload.
- The edge function supports `{ reset: true }`, but the UI never uses it.
- Your screenshot still shows:
  - raw MIME boundary lines
  - a trailing `)`
  - encoded subject text in the list  
  Those are strong signs of **legacy broken rows still in `edumail_messages`**, not freshly re-parsed messages.

So the previous fix was incomplete: the parser changed, but the inbox data was never rebuilt.

## Fix plan

### 1. Add a real “Reset inbox and re-sync” action
Update both:
- `src/pages/dashboard/MailPage.tsx`
- `src/pages/dashboard/EduMailPage.tsx`

Add a clear admin/user action that:
- calls `supabase.functions.invoke('edumail-imap-sync', { body: { reset: true } })`
- wipes old inbox rows for that user
- resets `last_synced_uid`
- re-fetches messages immediately
- shows a success/error toast

This is the missing piece to actually replace the corrupted stored data.

### 2. Make normal refresh smarter
Keep the normal refresh button for incremental sync, but add a second repair action like:
- “Repair Inbox”
- or “Reset & Re-sync”

This avoids mixing “check new mail” with “rebuild broken mail”.

### 3. Harden the message renderer for bad legacy rows
Update `src/components/mail/MessageView.tsx` so it does **not trust `body_html` blindly**.

If `body_html` contains MIME artifacts like:
- `Content-Type:`
- `Content-Transfer-Encoding:`
- multipart boundary markers
- IMAP trailer fragments
- looks like plain text with no real HTML tags

then:
- skip `dangerouslySetInnerHTML`
- render cleaned plain text instead

This gives a safe fallback even before reset is run.

### 4. Improve sanitization rules
Expand the current cleanup in `MessageView.tsx` to also strip:
- trailing standalone `)`
- `MIME-Version:`
- `charset=`
- `boundary=`
- other common mail header leftovers
- encoded-word subjects/body fragments where needed

This helps old rows look less broken.

### 5. Optional UX: show repair banner when suspicious messages are detected
If the selected message body looks like raw MIME, show a small banner:
- “This email was synced with an older parser. Repair inbox to re-import clean content.”

This makes the issue understandable instead of looking random.

## Files to change

| File | Change |
|---|---|
| `src/pages/dashboard/MailPage.tsx` | Add “Reset & Re-sync Inbox” flow using `{ reset: true }`, refetch queries afterward |
| `src/pages/dashboard/EduMailPage.tsx` | Add the same repair/reset action from the account-level mail page |
| `src/components/mail/MessageView.tsx` | Detect fake/broken HTML, prefer cleaned plain text, strengthen MIME cleanup |
| `supabase/functions/edumail-imap-sync/index.ts` | Keep current reset support; only adjust if needed for cleaner reset response payload |

## Expected result

After this:
- old corrupted inbox rows get removed
- messages are re-imported using the fixed parser
- raw MIME boundaries stop appearing
- encoded subjects should display properly
- even if a bad row still exists temporarily, the message view will degrade more safely

## Important note
The parser fix alone cannot solve already-saved broken messages. The inbox must be **re-synced with reset**, and the UI currently does not expose that path. That is the main reason it still looks unsolved.
