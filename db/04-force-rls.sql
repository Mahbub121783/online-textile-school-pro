-- ============================================================
-- CRITICAL: Postgres exempts the table OWNER from RLS policies unless
-- FORCE ROW LEVEL SECURITY is also set. On real Supabase this never
-- mattered because anon/authenticated/postgres are different roles from
-- whichever role owns the tables. Here, tecnedub_ots_app is BOTH the only
-- connecting role AND the owner of every table it created (bootstrap +
-- migrations), so without FORCE, every RLS policy is silently bypassed for
-- every single query. Must run LAST, after every table exists.
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, c.relname AS table
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relrowsecurity = true
      AND c.relforcerowsecurity = false
      AND n.nspname IN ('public', 'storage')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', r.schema, r.table);
  END LOOP;
END $$;
