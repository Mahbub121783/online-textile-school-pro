

User provided:
- Pixel ID: `1005930275539761` (visible in screenshots)
- Test Event Code: `TEST4851`
- Access Token: `EAALZAqW4QOW0BRI...ZDZD`

Access token must NOT be hardcoded — store as Supabase secret. Pixel ID and Test Event Code are safe in code/admin settings.

# Meta Pixel + Conversions API — Implementation Plan

## Credentials received
- **Pixel ID**: `1005930275539761` ✅
- **Test Event Code**: `TEST4851` ✅
- **Access Token**: will be stored as `META_CAPI_ACCESS_TOKEN` Supabase secret (never in code) ✅

## What gets built

### 1. Browser Pixel
- `index.html` — Meta Pixel base script in `<head>` with Pixel ID `1005930275539761`; `<noscript><img>` fallback in `<body>`
- `src/lib/metaPixel.ts` — `trackEvent(name, params, userData?)` helper that:
  - Generates unique `event_id` per event
  - Calls `fbq('track', ...)` browser-side
  - Mirrors to `meta-capi` edge function server-side (deduplication via shared `event_id`)
  - Respects `useCookieConsent` — fires only after marketing consent
  - Reads enable/disable + test code from settings table

### 2. CAPI Edge Function (`supabase/functions/meta-capi/index.ts`)
- Reads `META_CAPI_ACCESS_TOKEN` + `META_PIXEL_ID` secrets
- SHA-256 hashes email/phone/name before sending
- Captures `client_ip_address`, `client_user_agent`, `fbp`, `fbc` cookies
- Includes `test_event_code` from request when present
- POSTs to `https://graph.facebook.com/v19.0/{PIXEL_ID}/events`

### 3. Engagement Tracking Hook (`src/hooks/useEngagementTracking.ts`)
- TimeOnPage: fires at 30s, 60s, 120s
- PageScroll: fires at 25%, 50%, 75%, 100% (once per page)
- InternalClick: delegated listener on internal `<a>` clicks
- Resets on route change

### 4. Event Wiring

| Event | Where | Payload |
|---|---|---|
| PageView | `App.tsx` route listener | url, title |
| AddToCart | `cartStore.ts` `addItem` | content_id, content_type, value, currency |
| InitiateCheckout | `Checkout.tsx` mount | num_items, value, currency, contents[] |
| Purchase | `PaymentSuccess.tsx` after verify | order_id, value, currency, contents[] |
| TimeOnPage | engagement hook | duration_seconds, page |
| PageScroll | engagement hook | percent, page |
| WatchVideo | `SecureMediaPlayer.tsx` | video_id, milestone (25/50/75/100) |
| InternalClick | engagement hook | href, text |

### 5. Admin SEO/Tracking UI (`AdminSettings.tsx`)
New "Meta Pixel" card:
- Pixel ID input (default: `1005930275539761`)
- Test Event Code input (default: `TEST4851`, clearable for production)
- Enable/disable toggle
- "Send test event" button → fires sample PageView, shows result
- Status: secret presence + last event timestamp

### 6. Database
Add to `site_settings` (key/value pattern, no schema change needed) or new columns on `settings` table:
- `meta_pixel_id` (default `1005930275539761`)
- `meta_pixel_test_code` (default `TEST4851`)
- `meta_pixel_enabled` (default `true`)

## Files

| File | Change |
|---|---|
| `index.html` | Pixel script + noscript fallback |
| `src/lib/metaPixel.ts` (new) | Browser+CAPI dispatcher with consent check |
| `src/hooks/useEngagementTracking.ts` (new) | Time/scroll/click tracking |
| `src/App.tsx` | Mount engagement hook + route PageView |
| `src/stores/cartStore.ts` | AddToCart fire |
| `src/pages/cart/Checkout.tsx` | InitiateCheckout fire |
| `src/pages/payment/PaymentSuccess.tsx` | Purchase fire with real value |
| `src/components/media/SecureMediaPlayer.tsx` | WatchVideo quartile fires |
| `src/pages/admin/AdminSettings.tsx` | Meta Pixel admin card |
| `supabase/functions/meta-capi/index.ts` (new) | CAPI relay with hashing |
| `supabase/migrations/...sql` | site_settings rows for pixel config |

## Required secret
Will request `META_CAPI_ACCESS_TOKEN` (your access token) via the secure secret prompt in the next step — never written to code or repo.

## Result
Every event fires twice (browser + server) with shared event ID for Meta deduplication. Test code `TEST4851` stays active until you remove it from Admin Settings → live events appear in your "Test Events" tab in real time. Once verified, clear the test code field to start counting toward real campaign data.

