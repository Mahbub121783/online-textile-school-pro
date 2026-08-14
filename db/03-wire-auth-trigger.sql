-- ============================================================
-- Wires up the auth.users -> public.handle_new_user() trigger.
-- On real Supabase this is set up once outside the migration history
-- (via the dashboard/CLI), so it isn't in any of the 90 migration files.
-- Must run AFTER all migrations, once handle_new_user() exists.
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
