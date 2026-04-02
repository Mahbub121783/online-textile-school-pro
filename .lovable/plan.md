

## Plan: Redesign ID Card — Oxford-Style with Full-Width Barcode Bar & Larger Typography

### What's Wrong (comparing screenshots)

| Issue | Current | Target |
|-------|---------|--------|
| **Header text too small** | University name 26px, location 14px, "STUDENT ID CARD" 16px | University name ~34px bold, "STUDENT ID CARD" ~20px bold |
| **Barcode is tiny and centered** | 280x38px barcode floating in white space | Full-width dark bar across the bottom ~70% width with barcode + card number — like Oxford card |
| **Signature area weak** | Small signature image + thin line, tucked into corner | Proper signature line with clear authority name/position, well-spaced |
| **Footer wastes space** | Large empty gap between fields and barcode | Compact validity + signature row, then full barcode bar at bottom |
| **Label font too small** | 12px labels barely readable | 14px labels in a distinct color with colon styling |

### Redesigned Layout

```text
┌─────────────────────────────────────────────────────────┐
│ [LOGO 70x70]  Online Textile School      STUDENT ID     │  ← Header 110px
│               Dhaka, Bangladesh             CARD        │     Name 34px, badge 20px
├─── teal accent 4px ────────────────────────────────────-┤
│                                                         │
│  ┌────────┐   NAME :        Md. Mahbubul Alam           │  ← Fields 14px label, 18px value
│  │        │   ROLL :        OTS-181033                  │
│  │ PHOTO  │   BLOOD GROUP : A+                          │
│  │170x210 │   DATE OF BIRTH: 08 Feb 2000                │
│  │        │   ADDRESS :     Barisal                     │
│  └────────┘                                             │
│                                                         │
│  Valid Until: Sep 2027          ─────────────────        │  ← Signature area
│                                 Authority Name          │
│                                 Position                │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← Dark barcode bar
│         ▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌   OTS-ID-448960            │     70% width, 60px tall
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
└─────────────────────────────────────────────────────────┘
```

### Key Changes in `src/lib/idCardRenderer.ts`

**Header (110px):**
- Logo increased to 70x70
- University name: bold 34px (was 26px)
- Location: 16px (was 14px)
- "STUDENT ID CARD": bold 20px (was 16px)
- Teal accent line: 4px (was 3px)

**Body:**
- Photo: 170x210 (slightly larger)
- Labels: 14px semi-bold in slate color with " :" suffix
- Values: 18px bold dark
- Row height: 46px for breathing room

**Footer — Signature area:**
- Validity text left-aligned, 14px
- Signature image + line on right side, wider (160px line)
- Authority name 14px bold, position 12px — both clearly visible

**Barcode bar (Oxford-style bottom strip):**
- Dark background strip (matching header color) spanning full card width, 70px tall
- Barcode rendered white-on-dark, 70% of card width (~700px), 50px tall
- Card number in white monospace text below barcode, centered
- This replaces the floating barcode + accent bar

### File Summary

| File | Action |
|------|--------|
| `src/lib/idCardRenderer.ts` | Rewrite layout — bigger header text, Oxford-style full-width barcode bar, improved signature area |

Single file edit.

