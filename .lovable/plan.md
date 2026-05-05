
# Optimization Audit — Ki Break Hoiche, Ki Hoy Nai

Recent free-tier optimization (App.tsx defaults, useAuth, useEngagementTracking, useSettings, useCurrency, usePopupEngine, SponsorsSection, Index.tsx LazySection) — full system check korechi. **Major kono feature break hoy nai**, but kichu side-effect/trade-off ase ja addressing dorkar.

## ✅ Verified working (no break)

1. **useAuth** — `INITIAL_SESSION` skip kora hoyeche karon `getSession()` already handle korche. `SIGNED_IN`/`SIGNED_OUT`/`TOKEN_REFRESHED` shob event ekhono process hocche. Profile/roles + realtime subscription intact.
2. **useEngagementTracking** — no-op kora hoyeche. Hook signature same, call sites unaffected. PageView (Meta CAPI) ekhono `App.tsx` te route change e fire korche.
3. **useCurrency** — `select('code, symbol, exchange_rate, is_default')` — `CurrencySelector` only `code` + `symbol` use kore, `useConvertPrice` `code` + `exchange_rate` use kore. `AdminCurrencies` ta separate query (`select('*')`) — admin CRUD intact.
4. **useSettings** — `select('key, value')` only. `useSetting(key)` consumers shob ei 2 column e use kore. SEOHead, footer, branding shob fine.
5. **SponsorsSection** — click tracking disable korechi but link open korar functionality intact.
6. **Index.tsx LazySection** — `rootMargin: 200px` use korche, FeaturedCourses (first below-hero section) timely render hobe.

## ⚠️ Trade-offs (UX impact, not break)

| Area | Behavior | Impact |
|---|---|---|
| Global QueryClient `staleTime: 15min` + `refetchOnMount: false` | Page revisit e fresh data fetch hobe na | Admin-published new course/post 15 min loga te dekhabe (until manual invalidate) |
| `usePopupEngine` 30-min `window.__popupCache` | Admin saved new popup ta same session e 30 min por dekhabe | Popup admin testing kora kothin |
| `useSettings` 30-min cache | Admin settings change shoonge shoonge reflect hobe na | Logo/contact update 30 min late |
| `retry: 0` global | Network timeout e retry hobe na | Free-tier 504/timeout e blank section dekhate pare (Supabase JS still retries internally) |

## 🛠 Recommended fixes

1. **Admin pages exempt korbo** — admin queries (e.g. `AdminCurrencies`, `AdminSettings`, `AdminPopups`, `AdminUsers`) e per-query `staleTime: 0, refetchOnMount: 'always'` add korbo, jate admin live data dekhe.
2. **Mutation invalidation flow tighten** — jekhane admin `update`/`insert` korche, `qc.invalidateQueries({ queryKey: [...] })` use kora — many places already kore, audit kore missing gulo add korbo.
3. **Popup cache key reduce** — `30min → 5min`, ar admin save korle clear korar mechanism (window event or short staleTime) jog korbo.
4. **`retry: 1`** global e — 0 theke 1 e nilo, jate transient network blip e empty UI na dekhay (1 retry minimal load).
5. **Optional**: `useEngagementTracking` ke completely off na rakhe, only `TimeOnPage` + `PageScroll` off, ar `InternalClick` keep korbo (low frequency, useful analytics).

## Files to touch

- `src/App.tsx` — `retry: 0 → 1`
- `src/hooks/useSettings.ts` — admin path detect kore short stale, ba ekta `useSettingsLive()` variant
- `src/hooks/usePopupEngine.tsx` — cache 5 min + admin invalidation
- `src/pages/admin/AdminCurrencies.tsx`, `AdminSettings.tsx`, `AdminPopups.tsx` — per-query overrides
- (Optional) `src/hooks/useEngagementTracking.ts` — re-enable InternalClick only

## Out of scope (alada msg e korte hobe)

- Login intermittent failures — eta Supabase free-tier infrastructure pressure (504 timeout dekha gechilo). Code thik ase. Database upgrade ba off-peak retry chara solve korar moto kichu nai.

Approve korle ami implement korbo.
