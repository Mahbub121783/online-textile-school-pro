## Goal

Resolve the security warnings shown in the Security panel after publishing. Most are real issues we can fix via SQL migration; two require a manual toggle in the Supabase dashboard.

## What we'll fix automatically (single SQL migration)

### 1. Error: `user_roles` broadcast on Realtime
**Fix:** Remove `public.user_roles` from the `supabase_realtime` publication. The admin UI doesn't need live role updates — refresh on demand is enough. This also resolves the related "Role assignments broadcast" warning.

```sql
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_roles;
```
Then remove the `user_roles` listener from `src/hooks/useRealtime.ts` (admin queries already invalidate on user actions).

### 2. SMS logs SELECT gap
**Fix:** Add an explicit restrictive SELECT policy so only admins can read `sms_logs` (closes any ambiguity from the existing `FOR ALL` policy).

```sql
CREATE POLICY "Only admins can read sms_logs"
  ON public.sms_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));
```

### 3. Quizzes with NULL `course_id` privilege escalation
**Fix:** Tighten the policy so instructors can only manage quizzes attached to a course they own; NULL-course quizzes restricted to admins.

```sql
DROP POLICY "Instructors manage quizzes of their courses" ON public.quizzes;
CREATE POLICY "Instructors manage quizzes of their courses"
  ON public.quizzes FOR ALL TO authenticated
  USING (
    (course_id IS NOT NULL AND can_manage_course(course_id))
    OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    (course_id IS NOT NULL AND can_manage_course(course_id))
    OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
  );
```

### 4. SECURITY DEFINER functions executable by anon/authenticated
**Fix:** Revoke `EXECUTE` from `anon` and `authenticated` on internal helper functions that should only run from triggers / edge functions / other SECURITY DEFINER functions. We'll keep callable: `has_role`, `can_manage_course`, `can_manage_content_contributors`, `search_forum`, `increment_*_view`, `increment_*_download` (these are intentionally callable). Revoke from the rest (`credit_wallet`, `debit_wallet`, `notify_admins`, `cleanup_old_ai_chats`, `auto_update_workshop_status`, `enforce_name_change_cooldown`, `update_*` trigger functions, `handle_new_user`, etc.).

### 5. RLS Policy Always True
**Fix:** Find any non-SELECT policy with `USING (true)` / `WITH CHECK (true)` and tighten. We'll audit and replace with role-based or owner-based conditions.

### 6. Public bucket allows listing (`media`)
**Fix:** Add a restrictive listing policy so unauthenticated users can only download files by direct URL but cannot list bucket contents:
```sql
CREATE POLICY "Block listing of media bucket"
  ON storage.objects FOR SELECT TO anon
  USING (false);
-- Keep authenticated SELECT for reading metadata where needed.
```
(Direct public URLs for images still work — only the LIST operation is blocked.)

### 7. Extension in public schema
**Fix:** Move extensions (e.g., `citext`, `pg_net`, `http`) out of `public` into `extensions` schema where safe. We'll only move ones that are clearly safe to relocate; if any are referenced in existing code/migrations we'll leave them and document.

## What requires manual action (cannot fix via code)

### 8. Leaked Password Protection Disabled
You need to enable this in the Supabase dashboard:
**Authentication → Providers → Email → Enable "Leaked password protection"**

I'll include a direct link in the implementation message.

## Files to change

- `supabase/migrations/<ts>_security_hardening.sql` — all SQL fixes above
- `src/hooks/useRealtime.ts` — remove `user_roles` realtime subscription

## After implementation

Click "Update" in the Security panel to re-scan. The Error + 7 of the warnings should clear. The remaining one (Leaked Password Protection) clears once you enable it in the dashboard.

Approve to implement.