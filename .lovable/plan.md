
## Change

Drop NID + Emergency Contact, add WhatsApp number.

## DB migration
- Add `whatsapp_number text` to `user_profiles`.
- Drop columns `nid_number`, `emergency_contact` (recently added, no production data dependency expected).

## UI updates
- `src/pages/dashboard/SettingsPage.tsx` — remove NID + Emergency Contact inputs; add WhatsApp Number input (with country-code hint, optional "Same as phone" quick-fill).
- `src/components/shared/PublicProfileEditor.tsx` — remove if referenced.
- `src/pages/admin/StudentDetail.tsx` — drop NID/Emergency rows; show WhatsApp.
- `src/hooks/useProfileCompleteness.ts` — replace `nid_number` + `emergency_contact` weights with `whatsapp_number`.
- `src/integrations/supabase/types.ts` will refresh automatically after migration.

## Result
Profile no longer collects NID or emergency contact. Users can save a WhatsApp number, visible in admin and counted toward profile completeness.
