ALTER TABLE public.storage_migration_log
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_storage_migration_log_status ON public.storage_migration_log(status);
CREATE INDEX IF NOT EXISTS idx_storage_migration_log_pending ON public.storage_migration_log(status, attempt_count) WHERE status = 'pending';