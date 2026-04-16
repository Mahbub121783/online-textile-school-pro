
The user is asking whether the popup system is fully responsive across devices, has all features properly implemented, and whether the close (X) button and all CTAs work correctly.

Let me audit the existing implementation for issues.

Looking at `PopupLayout.tsx`:
- Center modal: `max-w-sm/md/lg/xl` with `p-4` outer padding — OK on mobile, but no `max-h` constraint → **content can overflow viewport on small screens, no scroll**
- Slide-in: `w-[calc(100vw-2rem)]` + `bottom-6 right-6/left-6` — on mobile this works, but no max-height → **can overflow vertically**
- Fullscreen: close button is positioned `absolute top-3 right-3` but parent is `fixed inset-0` — **close button positioning relative to scroll container, may be hidden when scrolling**
- Top/bottom banner: `pr-12` for close button room — OK, but on mobile with long text, content cramped
- No `max-h-[90vh] overflow-y-auto` on modal content (violates project memory rule for admin modals, applies here too)

Looking at `PopupRenderer.tsx`:
- `ImageVariant`: `onClick={() => popup.cta_primary_url && onClose('cta_primary')}` — calls onClose but **doesn't actually navigate to the URL** (missing `window.open`)
- `AnnouncementVariant`: no close handling for banner layout — relies on layout's close button ✓
- `HtmlVariant`: doesn't receive onClose, no CTA buttons → **no way to close custom HTML except X button** (OK, but no CTA tracking)
- `PromoVariant`: code source is `popup.cta_secondary_label` which is semantically wrong; should be a dedicated promo_code field (but using existing schema)
- CTA buttons use `window.open(url, '_blank')` — for internal routes this opens new tab which is jarring; should use react-router for relative URLs
- Form submission doesn't track analytics `submit` event server-side
- Close `reason` parameter passed to `onClose` but `usePopupEngine.close()` likely doesn't use it for analytics differentiation

Looking at responsiveness:
- Center modal `p-4` outer + `p-6` inner — on 320px screens with `max-w-sm` (384px) the modal might exceed viewport — OK due to `w-full` + `max-w-sm`
- Title `text-2xl`/`text-3xl` — fine
- CTA row uses `flex-col sm:flex-row` ✓
- Banner layouts: container `mx-auto px-4` — OK
- Slide-in uses `bottom-6` + `right-6` — on mobile (small height) might cover important content; should be `bottom-4 right-4` or similar with safe-area
- Video iframe `aspect-video` ✓
- Image variant `max-h-64` for hero image ✓ but no max for full image variant
- No safe-area-inset support for bottom banners on iOS notched devices

Bugs to fix:
1. **Modal overflow**: add `max-h-[90vh] overflow-y-auto` to modal content
2. **Fullscreen close button**: move outside scroll container so always visible
3. **ImageVariant CTA**: actually open the URL
4. **Internal URL handling**: use react-router navigate for relative paths instead of `window.open`
5. **Slide-in mobile spacing**: `bottom-4 right-4 left-4` on mobile for cleaner look
6. **Bottom banner safe area**: add `pb-[env(safe-area-inset-bottom)]`
7. **Banner close button on mobile**: ensure 44x44 tap target (currently `p-1.5` with `h-4 w-4` icon = ~28px, **below accessibility minimum**)
8. **HTML variant**: pass onClose to allow custom close buttons inside HTML (optional)
9. **Form submit**: log `submit` analytics event (currently only fired via close('submit'))
10. **Body scroll lock**: only applied for non-banner layouts ✓ but doesn't restore properly if multiple popups stack
11. **Backdrop click**: only on center_modal — slide-ins don't have backdrop (correct behavior actually)
12. **z-index conflicts**: z-[9999] same as chat widget — popup may be hidden behind chat
13. **Live preview in PopupBuilder**: need to verify it reflects all settings

Plan response below.
