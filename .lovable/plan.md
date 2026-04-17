

## Root Cause Analysis

The email system itself works (SMTP function is solid, templates exist, branded HTML wrapper, unsub handling). The **real problem is missing trigger calls** — emails are simply never invoked at the critical lifecycle events.

### Audit of email triggers (what's wired vs broken)

| Event | Expected template | Currently fires? | Issue |
|---|---|---|---|
| **Sign up / registration** | `user_registration` / `welcome_email` | ❌ NO | `Register.tsx` calls `supabase.auth.signUp` only — no email invoke |
| **Course enrollment (paid)** | `enrollment_confirmation` | ❌ NO | `process-payment` edge function creates enrollment, never sends email |
| **Course enrollment (free)** | `enrollment_confirmation` | ❌ NO | `useEnrollments` enroll mutation has no email send |
| **Workshop registration** | (custom) | ⚠️ BROKEN | `WorkshopDetail.tsx` line 120-122 sends `{ to, subject, html }` — but the edge function expects `{ recipientEmail, subject, body }`. Field names mismatch → silently fails |
| **Workshop live class link** | new template needed | ❌ NO | `AdminLiveClasses.tsx` saves meeting URL, never notifies registered attendees |
| **eBook purchase** | `ebook_purchase` | ❌ NO | Not wired in payment flow |
| **Order/payment** | `payment_received`, `order_confirmation` | ❌ NO | `process-payment` doesn't send emails |
| **Certificate** | `certificate_issued` | ✅ Works (`useEnrollments.ts:253`) | Only one wired correctly |

### Why nothing reaches user mail
1. **Wrong field names** in `WorkshopDetail` — `to`/`html` are silently ignored by the edge function (which reads `recipientEmail`/`body`), so workshop emails fail without throwing.
2. **No trigger calls anywhere else** — signup, enrollment, payment, live-class link delivery never invoke `send-smtp-email`.
3. There's no DB trigger or central orchestrator either, so even though the function and templates are perfect, nothing ever calls them.

---

## Fix Plan

### 1. Centralize via DB trigger + helper edge function (most reliable)
Rather than scattering invokes across 30 components, create a single **`notify-event` edge function** + DB triggers so emails fire automatically when rows are inserted — survives client-side failures, retries, and offline submissions.

But — to ship a working system fast and minimally invasive, I'll do a **hybrid** approach: client-side invokes for paths users initiate, plus DB trigger for backend events (payment, admin approval).

### 2. Concrete edits

**A. Fix WorkshopDetail.tsx (broken payload)**
Replace lines 107–124 to use proper `templateKey` + `placeholders` shape, OR use `recipientEmail`/`subject`/`body` — match the edge function contract.

**B. Add signup welcome email — `Register.tsx`**
After `supabase.auth.signUp` success, invoke `send-smtp-email` with template `user_registration`, placeholders `{ user_name, site_name, login_url, user_roll_id: '(pending)' }`.

**C. Add enrollment email — `useEnrollments.ts`** (free enrollment path) and **`process-payment/index.ts`** (paid path)
On successful enrollment row insert, invoke `send-smtp-email` template `enrollment_confirmation` with `{ user_name, course_name, course_url }`. Inside the edge function this is a server-to-server invoke.

**D. Add payment receipt — `process-payment/index.ts`**
After successful payment + enrollment, fire `payment_received` template.

**E. Add workshop live link broadcast — `AdminLiveClasses.tsx` / `AdminWorkshops.tsx`**
Add a new template `workshop_live_link` (with `{{workshop_title}}`, `{{meet_link}}`, `{{start_time}}`) plus an admin button **"Send Meet Link to Registered Attendees"** that:
- Fetches all `workshop_registrations` for the workshop
- Loops through and invokes `send-smtp-email` per attendee
- Logs results to admin toast

**F. Add ebook purchase email — `process-payment/index.ts`**
On ebook purchase success, fire `ebook_purchase` template.

**G. Optional safety net: DB trigger**
Add a Postgres trigger on `enrollments` insert → calls `pg_net.http_post` to `send-smtp-email` so that even if the client crashes mid-flow, the email still goes out. (This is the most defensive layer.)

### 3. New template to add
`workshop_live_link`:
```
Subject: Live Session Link — {{workshop_title}}
Body: Hi {{user_name}}, your live session for {{workshop_title}} starts at {{start_time}}.
Join here: {{meet_link}}
```
Added to `DEFAULT_TEMPLATES` in `send-smtp-email/index.ts`.

### 4. Verify after deploy
- Test each flow in preview, then check `Admin → Email Logs` for `sent` status.
- For any `failed` rows, the `error_message` column shows SMTP errors directly.

---

## Files to Edit

| File | Change |
|---|---|
| `src/pages/auth/Register.tsx` | Invoke `send-smtp-email` with `user_registration` after signup success |
| `src/pages/static/WorkshopDetail.tsx` | Fix payload field names (`to`→`recipientEmail`, `html`→`body`) |
| `src/hooks/useEnrollments.ts` | Add `enrollment_confirmation` invoke on free-enrollment success |
| `supabase/functions/process-payment/index.ts` | Add 3 invokes: `payment_received`, `enrollment_confirmation` (course) or `ebook_purchase` (ebook) |
| `supabase/functions/send-smtp-email/index.ts` | Add `workshop_live_link` to DEFAULT_TEMPLATES |
| `src/pages/admin/AdminLiveClasses.tsx` | New "Send link to attendees" button + handler |
| `src/pages/admin/AdminWorkshops.tsx` | Same "Broadcast meet link" button per workshop |
| (optional) `supabase/migrations/...sql` | Trigger on enrollments insert as safety net (skip for now unless requested) |

## Result
- Welcome email on signup → ✓
- Enrollment email (free + paid) → ✓
- Payment receipt → ✓
- Workshop registration confirmation → ✓ (was silently broken)
- Admin can broadcast live class link to registered attendees → ✓ new feature
- All sends visible in Admin → Email Logs with sent/failed status

