

The user wants to install Meta Pixel (Facebook Pixel) on their site with comprehensive event tracking. They need:
1. Instructions on where to find Pixel ID, Access Token (for Conversions API), and Test Event Code
2. Then implementation of browser-side Pixel + server-side CAPI with 8 specific events

Let me check current setup briefly. The project is React/Vite with React Router. Index.html exists, useAuth, cart store, lesson player exists for video tracking. From `.htaccess` I noticed an HTML5 constraint warning about `<noscript><img>` — must go in body, not head.

# Meta Pixel + Conversions API — Setup Guide & Implementation Plan

## Part 1 — How to find the 3 things you need

### A. Pixel ID (15–16 digit number)
1. Go to **business.facebook.com** → **Events Manager** (left sidebar)
2. Click **Data Sources** → select your Pixel (or create one: "Connect Data Sources" → Web → Meta Pixel)
3. Pixel ID shows at the top under the pixel name (e.g. `589923442958258` — visible in your screenshot)

### B. Access Token (for Conversions API — server-side tracking)
1. Events Manager → your Pixel → **Settings** tab
2. Scroll to **Conversions API** section → click **Generate access token**
3. Copy the long token immediately (shown only once). Looks like: `EAAxxxxxxx...`
4. This goes into Lovable Cloud as a secret — never commit to code

### C. Test Event Code
1. Events Manager → your Pixel → **Test Events** tab
2. A code like `TEST12345` is auto-generated at the top
3. Copy it. While testing, every event will be tagged with this code so it shows up in the Test Events stream in real time. Remove from production.

Send these three values via the chat once you have them — Pixel ID + Test Event Code go directly in code; Access Token will be requested as a secure secret.

## Part 2 — What I'll build

### Browser-side Pixel (`fbq`)
- Inject Pixel base code in `index.html` (head) + `<noscript><img>` fallback in `<body>` (per HTML5 rules)
- Create `src/lib/metaPixel.ts` helper exposing `trackEvent(name, params, options)` with safe fallback if `fbq` not loaded
- Respects existing **CookieConsentBanner** — Pixel only fires after user accepts marketing cookies

### Server-side Conversions API (CAPI) — for accuracy & iOS/ad-blocker bypass
- New edge function `meta-capi` that mirrors every browser event server-side
- Hashes user data (email, phone) with SHA-256 before sending
- Uses `event_id` to deduplicate browser + server events
- `ACCESS_TOKEN` and `PIXEL_ID` stored as Supabase secrets

### Events implemented

| Event | Trigger | File touched |
|---|---|---|
| **PageView** | Every route change | `src/App.tsx` (router listener) |
| **AddToCart** | Add to cart button | `src/stores/cartStore.ts` or detail pages |
| **InitiateCheckout** | Checkout page mount | `src/pages/cart/Checkout.tsx` |
| **Purchase** (standard name for "Checkout") | Payment success page | `src/pages/payment/PaymentSuccess.tsx` — uses real order value + currency |
| **TimeOnPage** | 30s + 60s + 120s timers | new `src/hooks/useEngagementTracking.ts` mounted in `App.tsx` |
| **PageScroll** | 25 / 50 / 75 / 100% depth | same hook |
| **WatchVideo** | Play / 25/50/75/100% / complete | `src/components/media/SecureMediaPlayer.tsx` |
| **InternalClick** | Click on internal `<a>` / `<Link>` | global delegated listener in `App.tsx` |

All events also fire to CAPI with hashed user data when logged in.

### Admin control panel
Add a **Meta Pixel** card to **Admin → Settings** with:
- Pixel ID input (saved to settings table — currently hardcoded works too if you prefer)
- Test Event Code input (toggle on/off for production)
- Enable/disable switch
- Live status badge ("Last event sent: 3s ago")

## Files Changed

| File | Change |
|---|---|
| `index.html` | Pixel base script in `<head>`, noscript pixel in `<body>` |
| `src/lib/metaPixel.ts` (new) | `trackEvent()` helper, consent-aware, dual browser+CAPI dispatch |
| `src/hooks/useEngagementTracking.ts` (new) | Time-on-page + scroll-depth + internal-click listeners |
| `src/App.tsx` | Mount engagement hook, route-change PageView |
| `src/stores/cartStore.ts` | Fire AddToCart |
| `src/pages/cart/Checkout.tsx` | Fire InitiateCheckout |
| `src/pages/payment/PaymentSuccess.tsx` | Fire Purchase with value+currency+order_id |
| `src/components/media/SecureMediaPlayer.tsx` | Fire WatchVideo at quartile milestones |
| `src/pages/admin/AdminSettings.tsx` | Meta Pixel config card |
| `supabase/functions/meta-capi/index.ts` (new) | Server-side CAPI relay with SHA-256 hashing |
| `supabase/migrations/...sql` | `meta_pixel_id`, `meta_pixel_test_code`, `meta_pixel_enabled` columns on settings |

## What I need from you to start

Reply with:
1. **Pixel ID** (e.g. `589923442958258`)
2. **Test Event Code** (e.g. `TEST12345`)
3. Confirm you want server-side CAPI too (recommended) — if yes, I'll request the **Access Token** as a secure secret in the next step

Once approved, implementation takes one pass.

