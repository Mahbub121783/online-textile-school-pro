

## Audit Result — Meta Pixel is Fully Wired ✅

All 8 events are correctly implemented in code:

| Event | File | Status |
|---|---|---|
| PageView | `App.tsx` (route listener) | ✅ |
| AddToCart | `cartStore.ts` (addItem) | ✅ |
| InitiateCheckout | `Checkout.tsx` (mount) | ✅ |
| Purchase | `PaymentSuccess.tsx` (after verify) | ✅ |
| TimeOnPage | `useEngagementTracking.ts` (30/60/120s) | ✅ |
| PageScroll | `useEngagementTracking.ts` (25/50/75/100%) | ✅ |
| WatchVideo | `SecureMediaPlayer.tsx` (play + quartiles) | ✅ |
| InternalClick | `useEngagementTracking.ts` (delegated) | ✅ |

CAPI edge function deployed, secrets set, dual-fire with `event_id` deduplication active.

## Why You Think It's "Not Working" — 3 Real Causes

### 🔴 #1 — Cookie consent gate (most likely cause)
`metaPixel.ts` line 73 returns silently if marketing cookie not accepted:
```ts
if (!hasMarketingConsent()) return;  // ← blocks everything
```
**Until a visitor clicks "Accept All" on the cookie banner, ZERO events fire.** This is GDPR-correct but means most of your test sessions emit nothing.

### 🟡 #2 — Test Events tab requires same browser session
The `TEST4851` code only shows events from the browser/device where the Pixel is loaded. If you check Test Events from a different machine than the one browsing the site, the tab looks empty.

### 🟡 #3 — Browser ad blockers / iOS
Browser-side `fbq` is blocked by uBlock, Brave, Firefox strict mode, Safari ITP. CAPI mirror still works (that's why we built it), so events DO arrive — they just won't show as "browser" pixel hits.

## The Fix (3 small changes)

### A. Make consent gate optional + add diagnostic logging
- Add `__META_PIXEL_REQUIRE_CONSENT__` flag (default `true`) — admin can toggle off for testing
- Add `console.debug('[MetaPixel] event fired/blocked', ...)` so you can see in DevTools exactly why each event was suppressed
- Add `window.__metaPixelDebug()` helper that logs current state: pixel ID, consent status, last event sent, CAPI reachability

### B. Auto-grant consent for admin/internal testing
When user has `admin` or `super_admin` role, auto-set marketing consent so admin browsing always fires events for testing without polluting real visitor consent flow.

### C. Admin Settings: "Run Diagnostic" button
Replace the simple "Send test event" with a full diagnostic that:
1. Checks `fbq` loaded
2. Checks consent status
3. Fires PageView via browser
4. Fires PageView via CAPI
5. Returns table: ✅/❌ per check + Meta's response code
Result shown inline so you immediately see what's broken.

## Files Changed

| File | Change |
|---|---|
| `src/lib/metaPixel.ts` | Add debug logging, consent override flag, `runDiagnostic()` export |
| `src/hooks/useCookieConsent.tsx` | Auto-grant marketing consent for admin/super_admin users |
| `src/pages/admin/AdminSettings.tsx` | Replace test button with full diagnostic panel + result table |

## Result
- You'll see in DevTools console exactly which events fire and which are blocked + why
- As an admin, every event fires automatically without needing to click cookie banner
- Diagnostic button shows green/red per-event status so you know in 5 seconds if Meta is receiving data

