-- id_card_settings (another pre-history "bootstrap" table -- see db/05
-- notes) was never seeded with its one required row. Both
-- StudentIdCard.tsx and AdminIdCardSettings.tsx fetch it with
-- `.select('*').limit(1).single()`, which errors/returns nothing on 0
-- rows -- so the student-facing ID card canvas never rendered (silently
-- stuck, since `settings` stayed undefined), AND the admin settings page
-- couldn't self-heal either: its save button explicitly throws
-- "No settings row found" when `settings?.id` is missing, since it only
-- ever does an UPDATE, never an INSERT. Confirmed live: 0 rows.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- "Admins manage id card settings" (FOR ALL) also had no service_role
-- branch -- same recurring pattern as every other fix this session.
DROP POLICY IF EXISTS "Admins manage id card settings" ON public.id_card_settings;
CREATE POLICY "Admins manage id card settings" ON public.id_card_settings
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

INSERT INTO id_card_settings (university_name, location, authority_name, authority_position, card_bg_color)
SELECT 'Online Textile School', 'Dhaka, Bangladesh', 'Registrar', 'Academic Affairs', '#1a365d'
WHERE NOT EXISTS (SELECT 1 FROM id_card_settings);
