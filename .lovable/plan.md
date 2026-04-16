

User says there's no "production mode" — they want a clear, visible way to switch between Test and Production. The current Admin UI just has a "Test Event Code" text field, which is not obvious.

Plan: add an explicit Mode selector (Test / Production) in Admin Settings → Meta Pixel that controls everything in one click.

Also: the screenshot shows "Failed to load" in Meta Events Manager — that's just an ad blocker on Meta's own dashboard, unrelated to our pixel. Receiving activity is green = events ARE arriving.

# Add Production Mode Switch to Meta Pixel

## What you'll get

A clear **Mode** selector at the top of Admin → Settings → Meta Pixel:

```text
┌─────────────────────────────────────────────┐
│  Meta Pixel Mode                            │
│  ( ) Test Mode    (•) Production Mode       │
│                                             │
│  ✅ LIVE — events count toward campaigns    │
└─────────────────────────────────────────────┘
```

- **Test Mode** → uses test code `TEST4851`, events appear in Meta "Test Events" tab only
- **Production Mode** → clears test code, events flow to live Pixel dashboard and count toward ad campaigns

One toggle, zero confusion. Status badge shows current state.

## Changes

| File | Change |
|---|---|
| `src/pages/admin/AdminSettings.tsx` | Add Mode radio (Test/Production) above test code field; clicking Production clears code, Test restores `TEST4851`. Add big colored status badge: red "TEST MODE" / green "LIVE / PRODUCTION". |
| `src/lib/metaPixel.ts` | No logic change — already uses test code presence to decide. Just expose helper `isProductionMode()` for badge. |

## After clicking "Production Mode" + Save

1. Test code field clears automatically
2. Badge turns green: "LIVE — Events count toward real campaigns"
3. All 8 events (PageView, AddToCart, etc.) start flowing to the **Overview** tab in Meta Events Manager (not Test Events)
4. Diagnostic panel "Test event code" row will show "empty (live campaign data)"

## About the "Failed to load" red box in your screenshot
That's Meta's own dashboard failing because **you have an ad blocker active on facebook.com**. Notice the green dot "Receiving activity TEST4851" right below it — that confirms events ARE arriving from your site. Disable ad blocker on Meta Events Manager tab to clear that red banner.

