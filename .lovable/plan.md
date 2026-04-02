

## Plan: Redesign ID Card — Clean, Professional, Properly Aligned

### Problems with Current Design

1. **Photo too small** (155x190) relative to 1012x638 card — looks lost
2. **Fields cramped** — 40px line height with 11px labels and 17px values doesn't leave enough breathing room
3. **Signature and validity pill float awkwardly** — not aligned to any grid
4. **Hex pattern watermark is distracting** — real university cards are clean
5. **Too much empty space** at the bottom, barcode area oversized
6. **Overall feels like a decorated web card, not a real ID card**

### Design Reference: Standard CR80 University ID Card

Real university ID cards (Oxford, MIT, etc.) follow a simple, clean structure:

```text
┌─────────────────────────────────────────────────────┐
│  [LOGO]  ONLINE TEXTILE SCHOOL        STUDENT ID    │
│          Dhaka, Bangladesh              CARD        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐   NAME:       Md. Mahbubul Alam      │
│  │          │   ROLL:       OTS-181033              │
│  │  PHOTO   │   BLOOD:      A+                      │
│  │ (square) │   DOB:        08 Feb 2000             │
│  │          │   ADDRESS:    Barisal                  │
│  └──────────┘                                       │
│                                                     │
│  Valid: Sep 2027    ────────────    [Signature]      │
│                                    Authority Name   │
│  ▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌  OTS-ID-448960             │
│━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
└─────────────────────────────────────────────────────┘
```

### Key Design Changes

**Header (compact, 100px):**
- Logo 60x60, not clipped to circle — show full logo with transparent bg
- University name bold 26px, location 14px — left-aligned beside logo
- "STUDENT ID CARD" text right-aligned in header, no pill/badge — just clean white text

**Body (clean grid, no decorative patterns):**
- Remove ALL hex watermark patterns
- Photo: 160x200 with simple 2px border, rounded 8px corners, no glow/shadow effects
- Fields: proper vertical spacing (44px per row), label 12px in muted color, value 16px bold
- Labels right-padded and colon-separated for clean alignment

**Footer (compact):**
- Left: validity text (small, simple)
- Right: signature line with name/position below
- Center bottom: barcode (narrower, 280px wide, 38px tall) with card number below
- Thin 4px bottom accent bar

**What's removed:**
- Hex patterns everywhere
- Glow/shadow on photo
- Gradient pill badges
- Oversized barcode area
- Excessive spacing

### File Changes

| File | Action |
|------|--------|
| `src/lib/idCardRenderer.ts` | Rewrite `renderIdCard` — clean layout, proper alignment, no decorative noise |

Single file edit. No other changes needed.

