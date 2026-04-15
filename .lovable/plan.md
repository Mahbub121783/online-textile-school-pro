

# Performance Fix — Eliminate Slow Loading & Double-Refresh Issues

## Root Cause Analysis

The app suffers from **three compounding performance problems**:

### Problem 1: Auth Race Condition (causes "double refresh" behavior)
The `AuthProvider` uses `getSession()` followed by `onAuthStateChange()`. When `onAuthStateChange` fires with `INITIAL_SESSION` before `getSession` resolves, it triggers a duplicate `fetchUserData` call. This causes components to flash between loading/loaded states, making users think they need to refresh twice.

### Problem 2: Homepage Fires 10+ Parallel Supabase Queries on Mount
The Index page eagerly loads 10 sections, each making 1-4 Supabase queries simultaneously. With `refetchOnMount: 'always'` in QueryClient defaults, every navigation back to home re-fires all queries. Combined with auth loading, this creates a waterfall of blocked renders.

### Problem 3: Duplicate Realtime Channels + Notification Subscriptions
- `NotificationBell` (via `useNotifications`) creates its own realtime channel with `Date.now()` suffix on every mount
- Layout-level realtime hooks (`useStudentRealtime`, `useAdminRealtime`) also subscribe to notification inserts
- This means duplicate subscriptions that trigger redundant query invalidations

## Fix Plan

### Step 1: Fix Auth — Prevent Race Condition
**File: `src/hooks/useAuth.tsx`**
- Skip the `onAuthStateChange` callback when it's the `INITIAL_SESSION` event (the `getSession()` call already handles initial load)
- This eliminates the double-fetch of `fetchUserData` and the loading flicker

```
Before:  onAuthStateChange((_event, session) => { ... })
After:   onAuthStateChange((event, session) => {
           if (event === 'INITIAL_SESSION') return; // already handled by getSession
           ...
         })
```

### Step 2: Fix QueryClient — Remove Aggressive Refetch
**File: `src/App.tsx`**
- Remove `refetchOnMount: 'always'` — this forces every query to re-fetch even when data is fresh, defeating the purpose of `staleTime: 5min`
- The 5-minute staleTime already handles freshness correctly

### Step 3: Optimize Homepage — Intersection Observer Loading
**File: `src/pages/Index.tsx`**
- Wrap below-the-fold sections in a simple visibility check so their queries don't fire until the section is scrolled into view
- HeroSlider + StatsSection load immediately; everything else loads when visible

### Step 4: Deduplicate Notification Realtime
**File: `src/hooks/useNotifications.ts`**
- Remove the per-component realtime subscription from `useNotifications` hook since the layout-level hooks (`useStudentRealtime`, `useAdminRealtime`, `useInstructorRealtime`) already handle notification invalidation
- This eliminates duplicate channels and redundant re-renders

### Step 5: Add `enabled` Guards on Unauthenticated Pages
Several homepage components (Header's `useAuth`, `NotificationBell`) trigger queries even on public pages where no user exists. Ensure all user-dependent queries have proper `enabled: !!user` guards (most already do, but the notification hook's realtime channel creates connections regardless).

## Files Modified
1. `src/hooks/useAuth.tsx` — Skip `INITIAL_SESSION` event
2. `src/App.tsx` — Remove `refetchOnMount: 'always'`
3. `src/pages/Index.tsx` — Add intersection-observer lazy loading for sections
4. `src/hooks/useNotifications.ts` — Remove duplicate realtime subscription

## Expected Impact
- Initial page load: ~50% fewer Supabase queries
- No more "double refresh" — auth resolves in one pass
- Dashboard/admin pages load on first visit without flicker
- Reduced WebSocket connections (fewer realtime channels)

