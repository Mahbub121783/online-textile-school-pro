

## Goal
Upgrade the role assignment UI in `AdminUsers.tsx` from simple add/remove buttons to an advanced, persistent, real-time role management system.

## Current Issues
1. Click "+ role" → fires mutation immediately, no save button, no confirmation
2. Click badge → instantly removes role (dangerous, no confirm)
3. No reflection of changes elsewhere until manual refresh
4. No expiry, no notes, no audit visibility
5. Single role assignment per click — can't batch multiple changes
6. No role descriptions / no visual hierarchy

## Plan

### 1. Redesign "Manage Roles" dialog (advanced UI)
Replace the current minimal dialog with a structured editor:

- **Role checklist with descriptions** — each role (`super_admin`, `admin`, `chief_marketer`, `content_writer`, `instructor`, `student`) shown as a checkbox row with:
  - Icon + colored badge
  - Short description ("Full system access", "Can publish posts", etc.)
  - Toggle switch (on = assigned)
- **Pending changes preview** — shows diff: "+ instructor", "− content_writer" before save
- **Save / Cancel buttons** — nothing persists until "Save Changes" clicked
- **Confirmation for sensitive roles** — assigning `super_admin` or `admin` triggers AlertDialog confirm
- **Optional note field** — admin can record reason ("Promoted to lead instructor")
- **Last modified info** — shows who assigned each current role and when (from `admin_activity_log`)

### 2. Persistent + atomic save
Single "Save Changes" handler:
- Computes diff (roles to add, roles to remove)
- Runs all inserts + deletes in one batched mutation
- Logs each change to `admin_activity_log` with the optional note
- Toast: "Updated 2 roles for {name}"

### 3. Dynamic propagation (real-time everywhere)
Make role changes reflect instantly across the app without refresh:

- **Realtime channel** on `user_roles` table — broadcast changes to all admin sessions
- **React Query invalidation** for affected keys: `admin-users`, `user-roles-{userId}`, `instructors`, `admin-instructors`
- **Affected user gets notification** — insert into `notifications` table: "Your role was updated to: instructor"
- **If target user is currently logged in**: their `useAuth` hook re-fetches roles via realtime listener so sidebar/menus update live (e.g., instructor sidebar appears immediately)

### 4. `useAuth` hook upgrade
Currently `useAuth` likely fetches roles once on login. Add realtime subscription:
- Subscribe to `user_roles` filtered by `user_id = auth.uid()`
- On change → refresh roles → triggers re-render of role-gated UI (sidebar, route guards, dashboards)

### 5. Audit-log surfacing
In the dialog, show last 5 role changes for this user (from `admin_activity_log` filtered by `target_id`).

## Files to Edit

| File | Change |
|---|---|
| `src/pages/admin/AdminUsers.tsx` | Replace inline role dialog with new `RoleManagerDialog` component, batched save mutation |
| `src/components/admin/RoleManagerDialog.tsx` (new) | Advanced UI: toggle switches, descriptions, diff preview, confirm for elevated roles, audit log |
| `src/hooks/useAuth.tsx` | Add realtime subscription on `user_roles` for current user; auto-refresh roles on change |
| `src/lib/roleDefinitions.ts` (new) | Central map: `{ role → { label, description, icon, color, requiresConfirm } }` reused in dialog + badges |

## DB / RLS
No schema change needed. Existing tables (`user_roles`, `admin_activity_log`, `notifications`) already support all required fields.

Realtime must be enabled on `user_roles` table — small migration to ensure `ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles` and `REPLICA IDENTITY FULL`.

## Result
- Role assignment becomes deliberate (Save button + confirm for admin/super_admin)
- Note field creates audit trail
- Changes propagate live to the affected user (sidebar/permissions update without logout)
- Other admin tabs auto-refresh via realtime
- Reusable role metadata across the app

