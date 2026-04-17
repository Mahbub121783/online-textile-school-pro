

## Two Changes

### 1. Remove the intrusive "New version available" prompt
The bottom banner ("নতুন ভার্সন পাওয়া গেছে! / A new version is available") comes from `src/components/UpdatePrompt.tsx`, mounted globally in `src/App.tsx`. PWA service worker will still auto-update silently in the background — users just won't see the popup.

- Delete the `<UpdatePrompt />` mount in `src/App.tsx`
- Delete the file `src/components/UpdatePrompt.tsx`
- Keep `useRegisterSW` auto-update behavior (silent reload on next navigation)

### 2. Add "Install App" option on Profile page
Use the standard PWA `beforeinstallprompt` event so mobile users can install the site as a native-like app from their Profile page.

**New component**: `src/components/InstallAppCard.tsx`
- Listens for `beforeinstallprompt` event, stashes the deferred prompt
- Detects if already installed (`display-mode: standalone` or iOS `navigator.standalone`) → hides card
- Detects iOS Safari (no native prompt API) → shows manual instructions: "Tap Share → Add to Home Screen"
- Android/Chrome → shows "Install App" button that fires the deferred prompt
- Bilingual label (Bengali + English) matching site style
- Uses existing card styling (matches "Profile Picture", "Personal Information" cards in screenshot)

**Mount location**: `src/pages/dashboard/SettingsPage.tsx` (the Profile Settings page shown in screenshot) — inserted at the top, just under the Profile Completeness bar, so it's the first thing mobile users see.

Card layout:
```text
┌─────────────────────────────────────────┐
│  📱  Install App                        │
│      অ্যাপ ইনস্টল করুন                  │
│      Get one-tap access from your home  │
│      screen. Works offline.             │
│                          [ Install ]    │
└─────────────────────────────────────────┘
```

## Files

| File | Change |
|---|---|
| `src/App.tsx` | Remove `<UpdatePrompt />` import + mount |
| `src/components/UpdatePrompt.tsx` | Delete file |
| `src/components/InstallAppCard.tsx` | **NEW** — beforeinstallprompt handler + iOS fallback |
| `src/pages/dashboard/SettingsPage.tsx` | Mount `<InstallAppCard />` near top |

## Result
- No more nagging update banner
- Mobile users see a clean "Install App" card on their profile that one-tap installs the PWA (Android) or shows iOS Add-to-Home-Screen instructions
- Card auto-hides once app is already installed

