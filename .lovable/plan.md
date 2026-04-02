

## Plan: Add Header Spacing, Logo Watermark & Website Text to ID Card

### 3 Changes in `src/lib/idCardRenderer.ts`

**1. Header spacing** — Add 10px top padding inside the header so content doesn't touch the card edge. Shift logo and text down by adjusting `logoY` and text baseline calculations to account for the padding.

**2. Logo watermark at 5% opacity** — After drawing the white card background and before drawing body content, draw the OTS logo centered on the body area at 5% opacity (`globalAlpha = 0.05`), sized ~300x300. This creates a subtle watermark behind the photo, fields, and footer.

**3. Official website text in the gap between Valid Until/Signature and barcode bar** — Currently there's ~100px of empty space between the signature area (~y=468) and the barcode bar (y=568). Add centered text in that gap:
- "Official Website : www.onlinetextileschool.com" at ~20px bold, centered horizontally, positioned at the vertical midpoint of the gap (~y=518), in the primary color.

### Layout Math

- Valid Until bottom: ~y=468 (validY + 68 for signature position text)
- Barcode bar top: y=568
- Gap center: ~y=518 — perfect for the website line

### File Summary

| File | Action |
|------|--------|
| `src/lib/idCardRenderer.ts` | Add header top padding, draw 5% opacity logo watermark on body, add website URL text in gap |

Single file edit.

