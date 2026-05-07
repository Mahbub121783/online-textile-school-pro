# Forgot Password — OTP Code via Email (SMTP)

Goal: User clicks "Forgot Password" → enters email → receives a **6-digit code** via your existing SMTP → enters code + new password → password reset. No Supabase magic link needed.

## Why a custom flow
Supabase's built-in `resetPasswordForEmail` sends a link (and uses Supabase's own SMTP/template). You want a **code emailed via your own `send-smtp-email` function**. So we build a small custom flow on top of your existing infra.

---

## 1. Database (new table)

`password_reset_codes`
- `id uuid pk`
- `user_id uuid` (nullable — looked up from email)
- `email text not null`
- `code_hash text not null` (sha256 of 6-digit code, never plaintext)
- `expires_at timestamptz not null` (10 minutes)
- `used_at timestamptz`
- `attempts int default 0` (max 5)
- `created_at timestamptz default now()`
- Index on `(email, created_at desc)`
- RLS enabled, **no public policies** (only service role accesses it via edge functions)

## 2. Two new edge functions

### `password-reset-request`
Input: `{ email }`
- Rate limit: max 3 codes / 15 min per email (check recent rows)
- Look up user in `auth.users` via admin API (don't reveal if user exists — always return success)
- Generate 6-digit code, store sha256 hash + 10-min expiry
- Call `send-smtp-email` with `templateKey: 'password_reset'`, placeholders `{ user_name, otp_code, expires_in: '10 minutes' }`
- Always return `{ success: true }` (anti-enumeration)

### `password-reset-verify`
Input: `{ email, code, new_password }`
- Find latest unused, non-expired code for email
- Increment `attempts`; lock after 5
- Compare sha256(code) vs stored hash
- If valid: use admin API `auth.admin.updateUserById(userId, { password })`, mark code `used_at`, invalidate all other codes for that email
- Return `{ success: true }` or precise error (`invalid_code`, `expired`, `too_many_attempts`)

Both functions: `verify_jwt = false`, use `SUPABASE_SERVICE_ROLE_KEY`, validate input with zod.

## 3. Email template update

Update `password_reset` default in `send-smtp-email/index.ts` to use OTP code instead of link:

> "Your password reset code is **{{otp_code}}**. It expires in {{expires_in}}. If you didn't request this, ignore this email."

(Keeps the same `templateKey` so admin-customized templates in DB keep working — they just need to use `{{otp_code}}` placeholder. We'll keep `{{reset_link}}` working too as a fallback.)

## 4. Frontend changes

### `src/pages/auth/ForgotPassword.tsx` — rewrite as 2-step wizard
- **Step 1:** Email input → calls `password-reset-request` edge function → moves to step 2
- **Step 2:** Shows InputOTP (6 digits) + new password + confirm password fields → calls `password-reset-verify` → on success, toast + redirect to `/auth/login`
- "Resend code" button (disabled 60s after send)
- "Change email" link to go back to step 1

Uses existing `<InputOTP>` component (already in `src/components/ui/input-otp.tsx`).

### `src/pages/auth/Login.tsx`
No change — "Forgot password?" link already points to `/auth/forgot-password`.

### `src/pages/auth/ResetPassword.tsx`
Leave as-is (still works for any old Supabase recovery links if used elsewhere).

---

## Security notes
- Codes hashed (sha256) at rest, never stored plaintext
- 10-minute expiry, 5-attempt lockout, 3 codes / 15 min per email
- No user enumeration (always returns success on request step)
- Password update done server-side via service role — never exposed to client
- All other codes for that email invalidated on successful reset

## Files
- New migration: `password_reset_codes` table + RLS
- New: `supabase/functions/password-reset-request/index.ts`
- New: `supabase/functions/password-reset-verify/index.ts`
- Edit: `supabase/functions/send-smtp-email/index.ts` (update `password_reset` template body to include `{{otp_code}}`)
- Edit: `src/pages/auth/ForgotPassword.tsx` (2-step OTP wizard)

After approval, the Google sign-in flow stays untouched, and any user with an email/password account can reset via the emailed 6-digit code.
