

## Plan: Perfect ID Card Layout — Bigger Photo, Tight Spacing, Professional Template

### Current Problems (from screenshot analysis)

| Issue | Detail |
|-------|--------|
| **Photo too small** | 170x210 on a 1012x638 canvas — needs 10% increase to 187x231 |
| **"Valid Until" floating in footer** | Currently at footerY+28, far from photo — needs to be 10px below the photo |
| **Too much empty space** | Gap between fields/photo and footer is wasted |
| **Signature area cramped** | Authority text too small relative to body |
| **Layout not tight enough** | Elements don't fill the card efficiently |

### Redesigned Layout

```text
┌──────────────────────────────────────────────────────────┐
│ [LOGO 76x76]  ONLINE TEXTILE SCHOOL       STUDENT ID    │  ← Header 116px
│               Dhaka, Bangladesh              CARD       │     38px / 20px / 22px
├─── teal 4px ─────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐   NAME :        Md. Mahbubul Alam         │  ← 16px label / 20px value
│  │          │   ROLL :        OTS-181033                 │     rowH = 46px
│  │  PHOTO   │   BLOOD GROUP : A+                        │
│  │ 187x231  │   DATE OF BIRTH: 08 Feb 2000              │
│  │          │   ADDRESS :     Barisal                    │
│  └──────────┘                                 ─────────  │  ← Signature line right-aligned
│  Valid Until: Sep 2027        Authority Name             │  ← 10px below photo
│                               Director, OTS              │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← Dark barcode bar 70px
│         ▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌   O T S - I D - 4 4 8 9    │
└──────────────────────────────────────────────────────────┘
```

### Key Changes in `src/lib/idCardRenderer.ts`

1. **Photo 10% bigger**: 170x210 → 187x231
2. **"Valid Until" repositioned**: Placed exactly 10px below the photo bottom (`photoY + photoH + 10`), left-aligned under the photo — 28px bold as before
3. **Signature section moved up**: Right-aligned, vertically aligned with the "Valid Until" text — signature line + authority name + position all in the space between fields end and barcode bar
4. **Remove floating footer separator line**: No more arbitrary `footerY` calculation — validity and signature sit naturally between body content and barcode bar
5. **Fields start higher**: `startY = bodyY + 10` (was +20) to reduce top gap in body
6. **Body gap reduced**: `bodyY = hH + 14` (was +20)

### What stays the same
- Header: 116px, 38px university name, 20px location, 22px "STUDENT ID CARD" — all good per last approval
- Barcode bar: 70px full-width dark strip at bottom with 70% width barcode
- All font sizes for labels (16px) and values (20px)

### File Summary

| File | Action |
|------|--------|
| `src/lib/idCardRenderer.ts` | Adjust photo size, reposition Valid Until below photo, tighten spacing, move signature inline |

Single file edit. No other changes needed.

