

# Critical Fix Plan: Auth, RLS, and Rendering Issues

## Root Cause Analysis

After deep investigation, I found **3 critical root causes** breaking the app:

### 1. Auth Deadlock (CRITICAL)
The `useAuth` hook uses `await` inside `supabase.auth.onAuthStateChange()`. Supabase docs explicitly warn this can cause deadlocks — blocking subsequent auth events from processing. This means:
- Roles may never load, causing admin "Access Denied"
- Profile data stalls, leaving dashboard in perpetual loading state
- `loading` stays `true` forever in some cases

### 2. RLS Policy on `user_roles` Blocks Public Queries (CRITICAL)
The `user_roles` table only allows users to see **their own roles**. But multiple components query it for **all instructors**:
- `InstructorSpotlight` (homepage) — fetches `user_roles WHERE role = 'instructor'` → returns empty for non-admins
- `AdminDashboard` — counts instructors via `user_roles` → fails silently
- This makes the homepage instructor section appear empty and admin stats show 0 instructors

### 3. Console `forwardRef` Warnings
`StatsSection` (CountUp component) and `InstructorSpotlight` pass refs to function components (`Skeleton`, `CountUp`) that don't use `forwardRef`, causing React warnings.

## Implementation Plan

### Fix 1: Refactor `useAuth` — Remove `await` from `onAuthStateChange`
**File**: `src/hooks/useAuth.tsx`
- Use `getSession()` as the primary session initializer
- In `onAuthStateChange`, update session/user synchronously, then fetch profile/roles via a non-blocking helper (no `await` in the callback — use `.then()` or a separate effect)
- Ensure `loading` is set to `false` reliably even if profile fetch fails

```text
Flow:
1. getSession() → set user/session → fetch profile/roles → set loading=false
2. onAuthStateChange → update user/session synchronously → re-fetch profile/roles (fire-and-forget)
```

### Fix 2: Add Public RLS Policy for Instructor Discovery
**Migration**: Add a new SELECT policy on `user_roles` that allows anyone to see rows where `role = 'instructor'` (non-sensitive — just links user_id to instructor role for discovery).

```sql
CREATE POLICY "Anyone can discover instructors"
ON public.user_roles FOR SELECT
USING (role = 'instructor'::app_role);
```

This is safe because:
- Only exposes the fact that a user_id is an instructor (already public via courses.instructor_id)
- Does not expose admin/super_admin roles
- The existing policy still handles own-role visibility

### Fix 3: Fix `forwardRef` Warnings
**Files**: `src/components/features/home/StatsSection.tsx`, `src/components/features/home/InstructorSpotlight.tsx`
- `CountUp`: Uses `useInView` which returns a ref callback. Wrap the receiving `div` directly instead of passing ref to a function component.
- `InstructorSpotlight`: Replace `<Skeleton ref={...} />` pattern — Skeleton doesn't accept refs. Wrap in a `div` that holds the ref.

### Fix 4: Defensive Query Error Handling
**Files**: `FeaturedCourses.tsx`, `EbookCatalog.tsx`, `DashboardOverview.tsx`
- Add `throwOnError: false` and error logging to critical queries
- Ensure silent Supabase errors (e.g., empty `data` with non-null `error`) are surfaced in the UI instead of showing blank states

## Technical Details

### Auth Refactor Pattern
```typescript
useEffect(() => {
  let mounted = true;
  
  // 1. Primary init — no await in callback
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!mounted) return;
    setSession(session);
    setUser(session?.user ?? null);
    if (session?.user) {
      fetchUserData(session.user.id).then(d => {
        if (!mounted) return;
        setProfile(d.profile);
        setRoles(d.roles);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  });

  // 2. Listener — fire-and-forget, NO await
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id).then(d => {
          if (!mounted) return;
          setProfile(d.profile);
          setRoles(d.roles);
        });
      } else {
        setProfile(null);
        setRoles([]);
      }
    }
  );

  return () => { mounted = false; subscription.unsubscribe(); };
}, []);
```

### Files to Edit
1. `src/hooks/useAuth.tsx` — auth refactor
2. `src/components/features/home/StatsSection.tsx` — fix ref warning
3. `src/components/features/home/InstructorSpotlight.tsx` — fix ref warning
4. New migration — add instructor discovery RLS policy

### Files to Verify (no changes expected)
- `AdminLayout.tsx` — should work once roles load properly
- `FeaturedCourses.tsx` — queries are correct, data exists
- `DashboardOverview.tsx` — depends on auth loading correctly

