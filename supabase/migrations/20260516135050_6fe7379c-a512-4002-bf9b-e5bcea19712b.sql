-- EMERGENCY: Previous hardening migration set temp_buffers = '4MB' but Postgres
-- stored it lowercase as '4mb', which it then rejects on every new session with
-- error 22023 ("invalid value for parameter temp_buffers"). This breaks 100% of
-- PostgREST/RPC traffic for anon, authenticated, and authenticator roles.
-- Reset to default to restore service immediately.
ALTER ROLE anon RESET temp_buffers;
ALTER ROLE authenticated RESET temp_buffers;
ALTER ROLE authenticator RESET temp_buffers;

-- Also reset any other potentially-bad per-role overrides from the same migration
-- to be safe (only reset known-set ones; harmless if unset).
DO $$
BEGIN
  -- best-effort: ignore failures
  BEGIN ALTER ROLE anon RESET work_mem; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER ROLE authenticated RESET work_mem; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER ROLE authenticator RESET work_mem; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;