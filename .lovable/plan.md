# Plan: Stabilize course/eBook detail pages and repair the purchase pipeline

## What I’ll fix

1. Stop the intermittent crash on single course/eBook pages.
2. Make add-to-cart, buy-now, cart, and checkout resilient when Supabase has transient failures.
3. Remove client-side purchase steps that are currently brittle under RLS / partial insert failures.
4. Verify the exact failure points with safer fallbacks instead of letting `ErrorBoundary` take down the page.

## Implementation

### 1) Harden course/eBook detail pages
- Audit the logged-in-only queries on `CourseDetail` and `EbookDetail`.
- Wrap non-critical queries so transient DB failures do not crash the full page:
  - enrollment check
  - pending order check
  - wishlist state
  - contributors
  - review/Q&A count
- Convert these to fail-soft behavior:
  - return safe defaults on read failures
  - show degraded UI states instead of throwing
- Guard any data access paths that can become `undefined` during partial failures.

### 2) Stabilize cart and checkout frontend flow
- Review `CartPage`, `Checkout`, `useCouponValidation`, cart store, and related helpers.
- Remove any crash-prone assumptions around coupon/application/payment gateway queries.
- Ensure cart browsing works even if coupon/gateway/config tables fail temporarily.
- Add defensive handling for checkout form prefill and derived totals so the page never hard-crashes.

### 3) Refactor purchase flow to tolerate partial DB/RLS failures
- Inspect the current multi-step client checkout flow:
  - create order
  - create order items
  - create invoice
  - write coupon usage
  - send notifications
  - wallet/manual/free completion logic
- Refactor so non-critical steps cannot break the whole purchase.
- Keep critical steps atomic from the UI perspective:
  - if order creation fails, show a clean actionable error
  - if optional side-effects fail, continue and log instead of breaking checkout
- Replace fragile `.single()` usage in risky places with safer read patterns where needed.

### 4) Align purchase flow with backend constraints
- Re-check active RLS policies for:
  - orders
  - order_items
  - invoices
  - coupon_usage / coupon_usages
  - enrollments
  - notifications
  - wallets / wallet_transactions
- If frontend logic is depending on writes that are no longer allowed or are too fragile, shift that logic to the safer path already used in the project patterns.
- If a DB-side patch is required, I’ll prepare the migration only for the exact blocked path.

### 5) Verification
- Re-test:
  - course detail page while logged in
  - eBook detail page while logged in
  - add to cart from catalog and single-product pages
  - buy now path
  - cart page load
  - checkout page load
  - at least one purchase path (free/manual/wallet depending on current config)
- Confirm the app now degrades gracefully during transient DB failures instead of showing the global “Something went wrong” screen.

## Technical notes
- I strongly suspect two overlapping causes:
  1. non-critical detail-page queries are still throwing during intermittent database/RLS hiccups for logged-in users;
  2. checkout is too dependent on sequential client-side inserts, so one transient failure breaks the whole purchase flow.
- I’ll fix both together so this doesn’t keep coming back intermittently.

## Expected result
- Single course/eBook pages open reliably.
- Cart and checkout remain usable.
- Purchase actions fail gracefully with clear errors instead of full-page crashes.
- Intermittent Supabase instability no longer causes the whole purchase flow to collapse.