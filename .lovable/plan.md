## Goal

Turn OTS into a polished installable app using the uploaded hexagon logo, add proper push-notification + reminder system that only activates after install, and place a clear "Install / Download App" button on every user profile.

---

## 1. New app icons from uploaded logo

- Copy `user-uploads://OTS_LOGO.png` → `src/assets/ots-app-logo.png` (source of truth).
- Generate all required PWA icons (placed in `public/`):
  - `logo-192.png` (192×192, padded white background, "any")
  - `logo-512.png` (512×512, padded white background, "any")
  - `logo-maskable-512.png` (512×512, safe zone padding for Android adaptive icons, "maskable")
  - `apple-touch-icon.png` (180×180, padded for iOS home-screen)
  - `favicon-32.png`, `favicon.ico`
- Update `index.html` favicon + apple-touch links and `vite.config.ts` PWA manifest icons (separate `any` and `maskable` entries — required so Android does not crop the hexagon).

> Note: "harmful app" warnings only appear for sideloaded APKs. PWAs installed from the browser never show this. Using a separate `maskable` icon and a clean manifest also prevents Chrome's "site missing icon/installability" warning.

---

## 2. Manifest polish (no scary install dialog)

Update VitePWA manifest:
- `name`: "Online Textile School"
- `short_name`: "OTS"
- `id`: "/?source=pwa"
- `scope`: "/"
- `start_url`: "/?source=pwa"
- `display`: "standalone", `display_override`: ["standalone", "minimal-ui"]
- `orientation`: "portrait"
- `theme_color`: matches header (Dark Teal token from project)
- `background_color`: matches splash
- `categories`: ["education"]
- `screenshots`: 2 entries (mobile + wide form factors) so Chrome shows the "rich install UI" instead of the basic prompt
- `shortcuts`: My Courses, Workshops, Notifications (long-press app icon menu)

---

## 3. Better in-app layout/interface when running as installed app

Detect standalone mode (`display-mode: standalone` OR `navigator.standalone`) and apply an `app-mode` class on `<html>`:
- Hide the marketing UtilityBar + top promo strip
- Hide the install banner
- Use compact Header with safe-area insets (`env(safe-area-inset-top/bottom)`)
- Promote `BottomNav` as primary navigation on mobile
- Add iOS status-bar meta tags: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black-translucent`, `apple-mobile-web-app-title=OTS`
- Tasteful splash screen: use theme color + logo while React boots (extends existing critical CSS in `index.html`)

---

## 4. Advanced notification system — install-only

Client side (only registers when running standalone):
- New hook `usePushNotifications.ts`:
  - Gate on `isStandalone()` — never asks permission in browser tab
  - Requests Notification permission with a clean in-app prompt card (not the raw browser dialog cold-start)
  - Subscribes to `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })`
  - POSTs subscription to edge function `push-subscribe`
- Service worker additions (custom `sw.ts` injected into VitePWA via `injectManifest` strategy):
  - `push` event → shows notification with title, body, icon (logo-192), badge, tag, actions, `vibrate`, `renotify`
  - `notificationclick` → focuses or opens deep link (`event.notification.data.url`)
  - `pushsubscriptionchange` → re-subscribes and syncs to server
- New settings page section "App Notifications" (visible only when installed) with toggles: Class reminders, Workshop reminders, Assignments due, Live class starting, New messages, Marketing.

Backend (Supabase):
- New table `push_subscriptions` (user_id, endpoint UNIQUE, p256dh, auth, user_agent, platform, last_seen_at).
- New table `notification_preferences` (per-category toggles).
- Edge functions:
  - `push-subscribe` — upsert subscription
  - `push-unsubscribe` — remove
  - `push-send` — sends a Web Push (VAPID) to one user / cohort, used by other functions
- Reminder triggers (reuse existing pg_cron pattern from `workshop-reminder-cron`):
  - Workshop start (T-24h, T-1h, T-10m)
  - Live class starting (T-15m, T-1m)
  - Assignment due (T-24h, T-2h)
  - Unread messages digest
- Secrets to add: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:).

> If the user has the app installed on multiple devices, every active subscription receives the push. Web Push works on Android, desktop Chrome/Edge/Firefox, and iOS 16.4+ (only after Add-to-Home-Screen — matches the "install-only" requirement).

---

## 5. "Install / Download App" button on every profile

- Reusable component `InstallAppButton.tsx` (built on existing `InstallAppCard` logic):
  - If already installed → renders nothing (or "App installed ✓" badge)
  - If `beforeinstallprompt` available → "Install App" button that triggers native prompt
  - On iOS Safari → opens an instruction sheet (Share → Add to Home Screen)
  - On desktop browsers without prompt → "Open in mobile to install" tooltip + QR code to current URL
- Place the button on:
  - `Profile.tsx` (own profile, prominent)
  - `ContributorProfile.tsx` (public profile, near share/endorse actions)
  - Dashboard sidebar footer (small variant)

---

## 6. Files

**New**
- `src/assets/ots-app-logo.png`
- `public/logo-192.png`, `logo-512.png`, `logo-maskable-512.png`, `apple-touch-icon.png`, `favicon-32.png`, `favicon.ico` (regenerated)
- `public/screenshots/mobile.png`, `public/screenshots/wide.png`
- `src/components/InstallAppButton.tsx`
- `src/hooks/usePushNotifications.ts`
- `src/hooks/useStandaloneMode.ts`
- `src/sw.ts` (custom service worker)
- `supabase/functions/push-subscribe/index.ts`
- `supabase/functions/push-unsubscribe/index.ts`
- `supabase/functions/push-send/index.ts`
- `supabase/functions/push-reminders-cron/index.ts`

**Edited**
- `vite.config.ts` (manifest, switch to `injectManifest`)
- `index.html` (icons, iOS meta, theme color)
- `src/main.tsx` (register custom SW outside preview)
- `src/components/layout/Header.tsx`, `UtilityBar.tsx`, `BottomNav.tsx` (standalone-mode trims + safe-area)
- `src/index.css` (`.app-mode` rules, safe-area utilities)
- `src/pages/Profile.tsx`, `src/pages/contributor/ContributorProfile.tsx`, `src/components/layout/DashboardSidebar.tsx` (place button)
- `src/pages/dashboard/SettingsPage.tsx` (notification preference toggles)

**DB migration**
- `push_subscriptions`, `notification_preferences` with RLS (user owns rows; service role for cron).

---

## Confirmation needed before I start

1. OK to add Web Push (requires generating a VAPID keypair and storing it in Lovable Cloud secrets)?
2. Replace the current sky-blue favicon/manifest icons with the new hexagon logo across the whole site, or keep them only for the installed app?
3. Show the Install button publicly on **contributor profiles** too, or only on the logged-in user's own profile + dashboard?
