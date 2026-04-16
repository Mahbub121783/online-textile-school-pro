

# Fix PWA App Version & Update System

## Root Cause
The app has a `manifest.json` with `display: standalone` (making it installable), but:
1. **No service worker** — the browser has no mechanism to check for updates
2. **No version tracking** — no way to detect when a new version is deployed
3. **No update prompt** — users who installed the app get permanently stale content

## What Will Change

### 1. Add vite-plugin-pwa with Proper Configuration
Install `vite-plugin-pwa` and configure it in `vite.config.ts` with:
- `registerType: "prompt"` — notifies users when a new version is available instead of silently updating
- `devOptions: { enabled: false }` — prevents issues in the Lovable preview
- `navigateFallbackDenylist: [/^\/~oauth/]` — protects auth routes
- Proper icon set (192px + 512px) in the manifest
- Cache strategy that ensures HTML is always network-first

### 2. Create an Update Prompt Component
Build `src/components/UpdatePrompt.tsx` — a toast/banner that appears when a new service worker is detected, with a "Update Now" button that reloads the app to the latest version.

### 3. Add Service Worker Registration Guard in main.tsx
Prevent service worker registration inside iframes or Lovable preview domains to avoid editor conflicts.

### 4. Update manifest.json
Add a 512px icon (required for full installability on Android), and ensure all fields are correct.

### 5. Cache-Control for Service Worker
Update `.htaccess` to set `Cache-Control: no-cache` on `sw.js` so the browser always checks for a new service worker file on each visit.

## Files Changed

| File | Change |
|------|--------|
| `vite.config.ts` | Add `VitePWA` plugin with prompt-based update |
| `src/components/UpdatePrompt.tsx` | **New** — "New version available" banner with reload button |
| `src/main.tsx` | Add iframe/preview guard for SW registration |
| `src/App.tsx` | Mount `UpdatePrompt` component |
| `public/manifest.json` | Add 512px icon, verify fields |
| `public/.htaccess` | Add no-cache rule for `sw.js` |

## Important Note
- PWA install and update features will only work on the **published/deployed** version, not in the Lovable editor preview
- A 512px icon PNG (`logo-512.png`) needs to be added to `/public/` — I'll create a placeholder or you can provide one

