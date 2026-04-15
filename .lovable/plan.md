

# Dashboard Issues — Deep Audit & Fixes

## Issues Found

### 1. Avatar Upload Fails: Missing Storage UPDATE Policy (Critical)
**Root cause**: The `storage.objects` table has an INSERT policy for authenticated users but **no UPDATE policy**. When using `supabase.storage.upload(path, file, { upsert: true })`, Supabase attempts an UPDATE if the file already exists. Without an UPDATE policy, replacing a photo always fails with "new row violates row-level security policy".

**Fix**: Add an UPDATE policy on `storage.objects` allowing authenticated users to update their own files in the `media` bucket.

### 2. Institutional Email Widget Visible to All Users
The `InstitutionalEmailWidget` is unconditionally rendered in `SettingsPage.tsx` (line 347). Per the memory notes, institutional email should only be available to students who have **purchased at least one course**.

**Fix**: In `InstitutionalEmailWidget`, check if the user has any enrollment. If none, don't render the widget.

### 3. Referral System is Completely Non-Functional
The registration page (`Register.tsx`) does **not**:
- Read the `?ref=` query parameter from the URL
- Save it to the user's `referred_by` field in `user_profiles`
- Create a `referral_rewards` record when the referred user pays

The `ReferralsPage.tsx` displays correctly but will always be empty because no referral data is ever created. The entire referral pipeline is missing.

**Fix**:
- **Register.tsx**: Read `?ref=` param, pass it as `user_metadata` during signup
- **`handle_new_user` DB trigger**: Update to read `ref` from `raw_user_meta_data`, look up the referrer by `referral_code`, set `referred_by` on the new user's profile, and insert a `pending` row into `referral_rewards`
- **Payment flow**: After successful payment (in `process-payment` edge function or checkout), check if the paying user was referred, and credit the referrer's wallet + update the referral_reward status to `credited`

### 4. No Storage UPDATE Policy for Instructors/Admins Either
The same UPDATE gap affects any file replacement across the platform.

**Fix**: The UPDATE policy should mirror the INSERT policy.

## Implementation Plan

### Step 1: Database Migration — Storage UPDATE Policy
Add an UPDATE policy on `storage.objects`:
```sql
CREATE POLICY "Authenticated users can update media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'media')
WITH CHECK (bucket_id = 'media');
```

### Step 2: Database Migration — Update `handle_new_user` Trigger
Modify the trigger to:
- Read `ref` from `raw_user_meta_data`
- Look up referrer by `referral_code` in `user_profiles`
- Set `referred_by` on the new user's profile
- Insert a `pending` record into `referral_rewards`

### Step 3: Register.tsx — Capture Referral Code
- Read `?ref=` from `useSearchParams`
- Pass it as `data: { full_name, ref: refCode }` in the `signUp` call

### Step 4: InstitutionalEmailWidget — Gate by Enrollment
- Query `enrollments` count for the current user
- If count is 0, return null (hide the widget)

### Step 5: Credit Referrer on Payment
- In the `process-payment` edge function, after successful enrollment, check if the user has `referred_by` set
- If yes, update the matching `referral_rewards` row to `credited` and call `credit_wallet` for the referrer

## Files Modified
1. **Database migration** — Storage UPDATE policy + `handle_new_user` trigger update
2. **`src/pages/auth/Register.tsx`** — Capture `?ref=` and pass to signup metadata
3. **`src/components/InstitutionalEmailWidget.tsx`** — Gate rendering behind enrollment check
4. **`supabase/functions/process-payment/index.ts`** — Credit referrer wallet on payment

