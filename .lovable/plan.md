

User is right — the button label "Migrate Supabase → Cloud" is vague. They want clarity that images go to Cloudinary, others to Cloudflare R2. Also implies the routing rule itself, not just the label.

Routing rule is already correct in `useFileUpload.ts`:
- Images → Cloudinary
- Everything else → Cloudflare R2
- Supabase = never

So this is purely a **UI labelling fix** on the AdminMedia page migration button + clearer wording in the toast/result messages.

## Plan

Update `src/pages/admin/AdminMedia.tsx`:

1. **Rename button** from "Migrate Supabase → Cloud" to **"Migrate: Images → Cloudinary, Files → Cloudflare R2"** (or shorter responsive variant).
2. **Add a small helper line** under the button explaining the rule: "Images route to Cloudinary, all other files to Cloudflare R2. Supabase is never used."
3. **Update progress/result toasts** to show split counts: "X images → Cloudinary, Y files → Cloudflare R2".
4. **Source badges** already exist (Cloudinary / R2 / Supabase-legacy) — verify they render with correct colors so admin can see at a glance.

No backend / edge function changes needed — routing logic is already correct.

## Files

| File | Change |
|---|---|
| `src/pages/admin/AdminMedia.tsx` | Rename button, add helper text, split counts in toast/result log |

## Result
Admin clearly sees: images always go to Cloudinary, every other file always goes to Cloudflare R2, Supabase is bypassed entirely.

