SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- `status` is NOT NULL with no default, but WalletPage.tsx's insert never
-- set it -- every single "Add Funds" submission from a real student has
-- been failing with a not-null-violation ("null value in column status").
-- Backfill is unnecessary since no row could ever have been inserted
-- without this default in place.
ALTER TABLE public.wallet_topup_requests ALTER COLUMN status SET DEFAULT 'pending';

-- `processed_at` defaulted to now() at INSERT time, which is wrong --  a
-- freshly-submitted, still-pending request has not been processed yet. It
-- should only be set when an admin actually approves/rejects (both
-- AdminWallets.tsx code paths already set it explicitly at that point).
ALTER TABLE public.wallet_topup_requests ALTER COLUMN processed_at DROP DEFAULT;
UPDATE public.wallet_topup_requests SET processed_at = NULL WHERE status = 'pending';
