## Goal
Fix the broken forgot-password flow so OTS-branded OTP email actually arrives. No other features touched.

## Root cause
`supabase/functions/password-reset-request/index.ts` calls `supabase.auth.admin.listUsers({ page: 1, perPage: 200 })`. Project has 260 auth users — anyone beyond the first 200 is silently not found, so no row in `password_reset_codes`, no email sent, function still returns `{success:true}` (anti-enumeration). User then sees only old default Supabase reset emails from previous tests.

## Single change
Edit `supabase/functions/password-reset-request/index.ts` only:
- Replace single `listUsers` call with a pagination loop (`perPage: 1000`, up to 20 pages = 20k users).
- Add small `console.log` lines (lookup found/not-found, smtp dispatch result) for future debugging via edge function logs.
- Keep behavior identical otherwise: same response shape, same anti-enumeration `{success:true}`, same rate-limit, same hash logic, same `password_reset` template call.

No other file changes:
- `password-reset-verify/index.ts` — untouched
- `send-smtp-email/index.ts` — untouched (template already has OTS-styled `{{otp_code}}` block)
- `ForgotPassword.tsx` — untouched
- `AccessBoardTab.tsx` admin reset — untouched (still uses Supabase native flow as before, no regression)
- DB schema — untouched

## Verification after deploy
1. Call `password-reset-request` with a real existing user email via curl.
2. Query `password_reset_codes` — confirm a row was inserted.
3. Check edge function logs for `lookup ... found: true`.
4. User receives OTS-branded email from configured SMTP `from_email` with 6-digit code.

## Risk
Zero impact on other features — only the user-lookup block inside one edge function is replaced. Function signature, response, and downstream flow unchanged.