-- ============================================================
-- More pre-history schema gaps found while live-testing ported edge
-- functions -- columns referenced by function/frontend code that were never
-- captured in supabase/migrations/ (same class as the missing
-- credit_wallet/debit_wallet functions in 06-wallet-functions.sql).
-- ============================================================

-- workshop-reminder-cron reads/writes workshops.reminder_sent_at to avoid
-- re-sending the "join now" email on every cron tick.
ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
