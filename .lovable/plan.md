

## Plan: Redesign Student ID Card — Premium University-Grade Design with Logo

### Problems

1. **Canvas design is basic** — flat header, plain Arial text, no visual hierarchy or branding polish
2. **The uploaded OTS logo is not embedded** — needs to be copied into the project and used as the default/fallback logo on the card
3. **StudentIdCard component wrapper is plain** — just a basic Card with no interactivity
4. **No visual flair** — no gradients, no decorative patterns, no shadow/depth effects on the canvas

### Design Overhaul

#### ID Card Canvas (`src/lib/idCardRenderer.ts`) — Complete Redesign

**Header:**
- Gradient header bar (deep navy to teal) instead of flat color
- Larger logo (90×90) with white circular backdrop for contrast
- University name in bold 32px, location in 20px — both properly centered beside logo
- "STUDENT ID CARD" badge styled as a pill/rounded rect with semi-transparent white background

**Body:**
- Photo: larger (180×220 portrait ratio), rounded corners with a colored border glow/shadow effect
- Fields use a two-column layout: labels in small caps gray, values in bold dark — cleaner spacing
- Add subtle horizontal divider lines between fields
- Decorative geometric pattern (hexagonal, matching the logo) as a faint watermark in the bottom-right

**Footer:**
- Validity dates in a styled colored pill bar
- Signature section with a thin line above for "Authorized Signature" label
- Barcode section with card number in spaced monospace
- Thin colored bottom strip matching the header gradient

#### StudentIdCard Component (`src/components/student/StudentIdCard.tsx`) — Interactive Wrapper

- Flip card animation: front shows the ID card canvas, click to flip and see a "back" with barcode enlarged, card number, validity details, and a QR-like element
- Hover glow effect with CSS shadow transition
- Status badge with pulse animation when active
- Download button with dropdown: PDF or PNG options
- Card tilts slightly on mouse move (3D perspective effect via CSS transforms)
- Responsive: full width on mobile, centered max-width on desktop

#### Copy Logo to Project

- Copy `user-uploads://OTS_LOGO.png` → `src/assets/OTS_LOGO.png`
- Use as fallback in the renderer when `settings.logo_url` is empty

### File Summary

| File | Action |
|------|--------|
| `src/assets/OTS_LOGO.png` | Copy from user upload |
| `src/lib/idCardRenderer.ts` | Complete redesign — gradient header, larger photo, watermark pattern, styled footer |
| `src/components/student/StudentIdCard.tsx` | Interactive wrapper — 3D tilt, flip animation, hover glow, PNG/PDF download, responsive |

No migration needed. 3 file changes total.

