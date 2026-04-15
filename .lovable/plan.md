

# Blank Page on Tab Switch — Root Cause & Fix

## Root Cause

The application has **no ErrorBoundary** anywhere. When navigating between lazy-loaded routes, if any component throws an error during render (or a dynamic `import()` chunk fails to load due to a network hiccup or cache invalidation after a deploy), the **entire React tree crashes to a white screen** with zero recovery. The only way back is a manual browser refresh.

Additionally, the `v7_startTransition: true` flag on `BrowserRouter` wraps navigations in React 18's `startTransition`. Combined with `Suspense`, this can cause the old UI to unmount before the new chunk finishes loading, resulting in a blank flash or permanent blank if the load fails.

## Fix Plan

### Step 1: Create a Global ErrorBoundary Component
**New file: `src/components/ErrorBoundary.tsx`**

A class component that:
- Catches render errors and chunk-load failures
- Shows a friendly "Something went wrong" UI with a **Retry** button
- Detects chunk-load errors specifically (`ChunkLoadError`, `Loading chunk failed`) and auto-retries once by calling `window.location.reload()`
- Resets its error state on navigation changes (via a `key` prop tied to `location.pathname`)

### Step 2: Wrap Routes with ErrorBoundary in App.tsx
**File: `src/App.tsx`**

- Wrap the `<Suspense>` inside an `<ErrorBoundary>` that resets on route change
- Use a small inner component that reads `useLocation()` to provide the reset key
- Remove `v7_startTransition: true` — it causes the blank flash between routes when combined with Suspense; the default behavior (synchronous transitions) is more reliable for this app's architecture

### Step 3: Add ErrorBoundary Around Layout Outlets
**Files: `AdminLayout.tsx`, `DashboardLayout.tsx`, `InstructorLayout.tsx`**

- Wrap each `<Outlet />` in its own `<ErrorBoundary>` so that if a child page crashes, the sidebar and header remain visible — only the content area shows the error/retry UI, rather than losing the entire layout

## Files Modified
1. **New**: `src/components/ErrorBoundary.tsx` — Reusable error boundary with retry
2. `src/App.tsx` — Add ErrorBoundary wrapper, remove `v7_startTransition`
3. `src/pages/admin/AdminLayout.tsx` — ErrorBoundary around `<Outlet />`
4. `src/pages/dashboard/DashboardLayout.tsx` — ErrorBoundary around `<Outlet />`
5. `src/pages/instructor/InstructorLayout.tsx` — ErrorBoundary around `<Outlet />`

## Technical Detail

The ErrorBoundary will detect chunk-load failures using this pattern:
```text
componentDidCatch(error) {
  if (error.name === 'ChunkLoadError' || error.message?.includes('Loading chunk')) {
    window.location.reload();  // auto-retry once
  }
}
```

The layout-level boundaries use `location.pathname` as a `key` so they auto-reset when the user clicks a different sidebar link — no manual refresh needed.

