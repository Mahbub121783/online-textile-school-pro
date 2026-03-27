

## Plan: Fix Blank Preview (Stale Vite Cache)

### Problem
The preview shows a blank white page. Browser console shows 404 errors for Vite dependency chunks (`chunk-4MBMRILA.js`, `chunk-3TFVT2CW.js`, `chunk-R6S4VRB5.js`). This happens when the Vite dev server's dependency pre-bundling cache becomes stale after many files were changed simultaneously during the import.

### Root Cause
All source files were created/modified in rapid succession. Vite's dependency optimizer cached old chunk hashes, and the browser is requesting chunks that no longer exist on the server.

### Fix
1. **Force Vite cache invalidation** by adding a trivial change to `vite.config.ts` (add `optimizeDeps: { force: true }`) -- this forces Vite to re-bundle all dependencies on next server start
2. **Make a small harmless edit to `src/main.tsx`** (add a comment) to trigger a full HMR reload

This is a one-line config change that will force a clean rebuild and fix the blank page.

### Technical Detail
- File: `vite.config.ts` -- add `optimizeDeps: { force: true }` inside the config object
- This tells Vite to discard its cached pre-bundled dependencies and regenerate them

