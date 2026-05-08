## Goal
Make `/auth/forgot-password` fully work end-to-end with an "advanced" experience — without breaking anything else:
- Email arrives from your own SMTP (OTS branded), not the default Supabase mail
- Email contains BOTH a 6-digit code AND a one-click reset link
- Strict attempt-limit so brute force is blocked
- UI shows masked email (`j••••@gmail.com`) on the verify step

## Why current flow fails
1. The OTS reset email is never sent because:
   - `password-reset-request` does `auth.admin.listUsers` — even with the new pagination loop, the lookup is fragile and currently the `password_reset_codes` table is empty (no row inserted = no email triggered).
   - The screenshot the user keeps seeing ("Supabase Auth … Follow this link") is the **default** Supabase recovery email triggered by the admin-side `AccessBoardTab.tsx` `resetPasswordForEmail()` button — not by the new OTP flow at all.
2. There is no fast, reliable user lookup in `auth.users` from edge function — listUsers is the wrong tool for 260+ users.
3. UI/email lacks the "advanced" polish (no link option, no masking, no proper lock UX).

## What we'll build (single coherent flow)

### 1. Database (one tiny migration)
- Add a SECURITY DEFINER function `public.find_auth_user_by_email(_email text)` returning `(user_id uuid, full_name text)` — does a direct, indexed lookup in `auth.users` (case-insensitive). Reliable and instant, no pagination.
- Add columns to `password_reset_codes`:
  - `link_token text` (random 48-char URL-safe token, hashed in DB? — stored as plain since it expires in 10 min and is one-time-use, like Supabase recovery tokens)
  - `locked_at timestamptz` (set when attempts ≥ 5)
- Index on `link_token` for fast verify.

### 2. Edge function `password-reset-request` (rewrite)
- Use `find_auth_user_by_email` instead of listUsers (the actual root-cause fix).
- Generate 6-digit `code` AND a 48-char `link_token`.
- Insert one row in `password_reset_codes` with both, `expires_at = now()+15min`.
- Build reset link: `${SITE_URL}/auth/reset-password?token=<link_token>&email=<email>`.
- Call `send-smtp-email` with `templateKey: 'password_reset'` and placeholders: `user_name`, `otp_code`, `reset_link`, `expires_in: '15 minutes'`.
- Anti-enumeration: always return `{success:true}`, but log internally.
- Rate limit: max 3 requests / 15 min per email (already there, kept).

### 3. SMTP template `password_reset` (update default body in `send-smtp-email/index.ts`)
- Add `{{reset_link}}` button below the OTP block.
- Add a "If the button doesn't work, copy this link" fallback.
- Keep existing `{{otp_code}}` styled block.
- Branded wrapper (logo, brand color, footer) is already applied automatically by `buildBrandedHtml` — no extra work.

### 4. Edge function `password-reset-verify` (extend, backward-compatible)
- Accepts EITHER `{ email, code, new_password }` OR `{ token, new_password }`.
- For `code` path: existing logic + when wrong code → `attempts++`; when `attempts ≥ 5` → set `locked_at = now()`, return `too_many_attempts`. Subsequent requests with same code blocked even if expiry not yet reached.
- For `token` path: lookup by `link_token`, same expiry/used/locked checks, then `auth.admin.updateUserById`.
- Mark `used_at` and invalidate all other unused codes for that email (already there, kept).

### 5. Frontend
- `src/pages/auth/ForgotPassword.tsx` (rework, same route):
  - Step 1: enter email → on success move to Step 2 showing **masked email** (`j••••@gmail.com`) and a hint "Check your inbox for a code OR click the magic link".
  - Step 2: show 6-digit OTP input + new password + confirm + strength hint (≥6) + resend countdown (already there) + "Change email" + clear lock message when server returns `too_many_attempts`.
  - On 5+ wrong attempts: disable submit, show "Too many attempts — request a new code" + force resend.
- `src/pages/auth/ResetPassword.tsx` (rework — currently expects Supabase hash, will be repurposed for our `?token=...` link):
  - Read `token` and `email` from query string.
  - Show new password + confirm fields → submit to `password-reset-verify` with `{ token, new_password }`.
  - On success: toast + redirect to `/auth/login`.
  - Backwards compat: if old Supabase `#access_token` hash is present, fall back to `supabase.auth.updateUser({password})` so existing in-flight links still work.
- `Login.tsx` "Forgot password?" link unchanged (already points to `/auth/forgot-password`).

### 6. Admin reset button (NO behaviour change requested earlier)
- `AccessBoardTab.tsx` `resetPasswordForEmail()` is left as-is so that path keeps working exactly like today. Optional toggle to switch later — not in this plan.

### 7. Verification after deploy
- Trigger forgot-password with a real existing email → confirm row inserted in `password_reset_codes` (both `code_hash` and `link_token` set) → confirm OTS-branded email arrives with both OTP block and "Reset Password" button → click button → password updated → login works.
- Try wrong code 5 times → row locked → resend works.

## Risk / blast-radius
- Zero impact on Login, Register, Google sign-in, admin reset button, or any other email template.
- `password_reset_codes` only adds 2 nullable columns + 1 index — additive, safe for existing rows.
- `send-smtp-email` only the `password_reset` default body string is updated (DB-stored template, if customised, is preserved — defaults are fallback only).
- `ResetPassword.tsx` keeps Supabase-hash fallback so any link already in transit still works.

## Files touched
1. New migration — `password_reset_codes` columns + `find_auth_user_by_email` function
2. `supabase/functions/password-reset-request/index.ts` — full rewrite (lookup + link token)
3. `supabase/functions/password-reset-verify/index.ts` — accept token path + lock logic
4. `supabase/functions/send-smtp-email/index.ts` — only the `password_reset` default body string
5. `src/pages/auth/ForgotPassword.tsx` — masked email + lock UX
6. `src/pages/auth/ResetPassword.tsx` — handle `?token=...` from email link
