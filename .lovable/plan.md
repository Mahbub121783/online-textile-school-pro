## Goal

Workshop participants currently get **no certificate on their profile** after completing a workshop, even when:
- The workshop has a certificate template configured
- Their profile is 100% complete
- They attended

The infrastructure exists (`certificates.workshop_id`, `workshops.cert_template_id`, `issue_workshop_certificate` RPC, `bulk_issue_workshop_certificates` RPC, "Workshop Certificates" section in `/dashboard/certificates`) — but issuance only happens when an admin manually clicks **"Issue certificates to all eligible registrants"**. There is no automation and no student-side claim button.

This plan adds **automatic assignment** + a **self-service claim flow** + a **"Pending Workshop Certificates"** section so students see their progress just like with courses.

---

## What changes

### 1. Auto-issue when workshop is marked completed (DB)
Add a trigger `auto_issue_workshop_certs_trigger` on `public.workshops`:
- Fires `AFTER UPDATE` when `status` transitions to `'completed'`
- If `certificate_enabled = true`, `cert_template_id IS NOT NULL`, and `certificate_auto_issue = true`, calls `bulk_issue_workshop_certificates(NEW.id)` internally (loops registrants and issues, skipping ineligible ones)
- Idempotent — `issue_workshop_certificate` already short-circuits if a cert exists

### 2. Allow students to self-claim (DB)
Currently `issue_workshop_certificate` only enforces that the workshop is completed and the user is registered — it does **not** require admin role. We will:
- Add a thin RPC wrapper `claim_my_workshop_certificate(_workshop_id uuid)` that calls `issue_workshop_certificate(_workshop_id, auth.uid())`
- This lets a logged-in student claim once admin has marked the workshop completed, even before admin's bulk-issue

### 3. Student dashboard — "Pending Workshop Certificates" section
In `src/pages/dashboard/CertificatesPage.tsx`:
- Query `workshop_registrations` (joined with `workshops`) for the current user where workshop has `certificate_enabled = true`
- Split into two groups:
  - **Workshop certs already issued** — existing section (unchanged design)
  - **Pending workshop certs** — new section showing: workshop title, status (upcoming / ongoing / completed), checked-in or not, profile completeness, and a **Claim Certificate** button (enabled only when workshop is `completed` + profile complete + attendance met)
- Requirement chips mirror the course-pending UI (✅/❌ rows for each criterion)
- Claim button → calls `claim_my_workshop_certificate` RPC, then refetches the workshop-certs query and toasts success

### 4. Admin polish (small)
In `src/pages/admin/AdminWorkshops.tsx`:
- Show a small badge on each workshop row indicating how many certificates have been issued vs eligible registrants (read from `certificates` count)
- No layout overhaul — minor addition next to "registrations" badge

---

## Out of scope (per your earlier instruction "certificate system jemon chilo omoni thakbe")
- No redesign of certificate gallery, designer, preview modal, share, verify page
- No changes to `certificate_templates`, PDF rendering, or course certificate flow

---

## Technical details

**Migration**
```sql
-- 1. Self-claim wrapper
create or replace function public.claim_my_workshop_certificate(_workshop_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return public.issue_workshop_certificate(_workshop_id, auth.uid());
end $$;

-- 2. Auto-issue on completion
create or replace function public.trg_auto_issue_workshop_certs()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if NEW.status = 'completed' and (OLD.status is distinct from 'completed')
     and NEW.certificate_enabled and NEW.cert_template_id is not null
     and coalesce(NEW.certificate_auto_issue, true) then
    for r in select user_id from public.workshop_registrations
             where workshop_id = NEW.id and status = 'registered' and user_id is not null
    loop
      begin perform public.issue_workshop_certificate(NEW.id, r.user_id);
      exception when others then null; end;
    end loop;
  end if;
  return NEW;
end $$;

drop trigger if exists auto_issue_workshop_certs_trigger on public.workshops;
create trigger auto_issue_workshop_certs_trigger
  after update on public.workshops
  for each row execute function public.trg_auto_issue_workshop_certs();
```

**Frontend touch-points**
- `src/pages/dashboard/CertificatesPage.tsx` — add `workshop_registrations` query, "Pending Workshop Certificates" section, claim mutation calling `supabase.rpc('claim_my_workshop_certificate', { _workshop_id })`
- `src/pages/admin/AdminWorkshops.tsx` — add a tiny "X certs issued" indicator per workshop row

**Behavior matrix**

| Scenario | Result |
|---|---|
| Admin marks workshop `completed` (auto_issue=true, template set) | All registrants auto-issued; notification sent (existing behavior of `issue_workshop_certificate`) |
| Admin marks completed, auto_issue=false | Nothing auto-issued. Student sees "Claim Certificate" button when eligible |
| Student profile incomplete | Pending card shows "Profile X% complete" requirement; download stays locked (existing) |
| Workshop not yet completed | Pending card shows "Awaiting workshop completion" — no claim button |
| Cert already issued | Moves to "Workshop Certificates" section automatically |

---

Approve to implement.