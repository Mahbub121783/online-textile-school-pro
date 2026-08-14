-- The `categories` table is one of the 50 pre-history "bootstrap" tables
-- reconstructed from types.ts (no backup existed) -- it got its schema and
-- RLS policies, but was NEVER seeded with actual rows. Confirmed live:
-- 0 rows. This is the root cause of "category-wise course browsing doesn't
-- work" -- the CourseCatalog filter sidebar and any category-scoped page
-- have nothing to show, and courses created via the admin/instructor
-- CourseBuilder have no category to pick from (category_id ends up NULL).
--
-- Also cleans up 3 orphaned user_profiles/user_roles rows left over from
-- earlier low-level signup-cascade testing (auth.users row for them no
-- longer exists; 0 wallets/enrollments reference them) -- these would
-- otherwise show up as fake "students" in AdminStudents.tsx, which queries
-- user_profiles directly without joining auth.users.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- Same recurring bug class again: user_profiles had NO delete policy at all
-- (INSERT/SELECT/UPDATE only). With FORCE ROW LEVEL SECURITY that means
-- this file's own cleanup DELETE below silently affected 0 rows the first
-- time it ran, and any future admin "delete account" feature would too.
DROP POLICY IF EXISTS "Service role and admins delete profiles" ON public.user_profiles;
CREATE POLICY "Service role and admins delete profiles" ON public.user_profiles
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

-- "Admins manage user roles" (FOR ALL) also had no service_role branch --
-- only the separate special-case "Signup assigns default role" INSERT
-- policy did. That's why the DELETE below silently removed 0 rows the
-- first time this file ran, and the subsequent user_profiles DELETE then
-- failed loudly on the FK instead.
DROP POLICY IF EXISTS "Admins manage user roles" ON public.user_roles;
CREATE POLICY "Admins manage user roles" ON public.user_roles
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

-- wallets' SELECT policy ("Users manage own wallet") also had no
-- service_role branch -- a service_role SELECT for these orphan ids
-- silently returned 0 rows (RLS false-empty-read), which masked the
-- wallet rows that were actually blocking the user_profiles DELETE below
-- via wallets_user_id_fkey. Add the branch so backend code can read
-- wallets at all (it could already INSERT/UPDATE as service_role, just
-- never SELECT).
DROP POLICY IF EXISTS "Users manage own wallet" ON public.wallets;
CREATE POLICY "Users manage own wallet" ON public.wallets
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND user_id = auth.uid())
  );

-- wallets also had zero DELETE policy at all.
DROP POLICY IF EXISTS "Service role deletes wallets" ON public.wallets;
CREATE POLICY "Service role deletes wallets" ON public.wallets
  FOR DELETE
  USING (auth.role() = 'service_role');

DELETE FROM user_roles WHERE user_id IN (
  SELECT p.id FROM user_profiles p LEFT JOIN auth.users u ON u.id = p.id WHERE u.id IS NULL
);
DELETE FROM wallets WHERE user_id IN (
  SELECT p.id FROM user_profiles p LEFT JOIN auth.users u ON u.id = p.id WHERE u.id IS NULL
);
DELETE FROM user_profiles p WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = p.id
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_slug_key') THEN
    ALTER TABLE categories ADD CONSTRAINT categories_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Same recurring bug class as db/07 / db/17 / db/19: "Admins manage
-- categories" had no service_role branch, so this file's own seed INSERT
-- (and any future backend-driven category management) was rejected by RLS.
DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins manage categories" ON public.categories
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

INSERT INTO categories (name, slug, sort_order) VALUES
  ('Spinning Technology', 'spinning-technology', 1),
  ('Weaving Technology', 'weaving-technology', 2),
  ('Knitting Technology', 'knitting-technology', 3),
  ('Dyeing & Finishing', 'dyeing-finishing', 4),
  ('Garments Manufacturing', 'garments-manufacturing', 5),
  ('Textile Quality Control', 'textile-quality-control', 6),
  ('Textile Management & Merchandising', 'textile-management-merchandising', 7),
  ('Denim Technology', 'denim-technology', 8),
  ('Nonwoven & Technical Textiles', 'nonwoven-technical-textiles', 9),
  ('Fashion Design', 'fashion-design', 10)
ON CONFLICT (slug) DO NOTHING;
