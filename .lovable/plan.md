

## Plan: Fill the ID Card — Larger Fonts, Bigger Photo, No Wasted Space

### Problems from Screenshot

| Issue | Current Value | Fix |
|-------|--------------|-----|
| **Photo too small** | 187x231, doesn't fill vertical space | Increase to **210x270** — fills from header to near validity line |
| **Labels tiny** | 16px semi-bold | Increase to **20px** bold |
| **Values small** | 20px bold | Increase to **24px** bold |
| **Label column too narrow** | labelW=160px, wastes right side | Increase to **200px** |
| **Huge gap between validity and barcode** | ~175px empty space | Photo expansion + tighter bodyY eliminates this |
| **"Valid Until" could be bolder** | 28px | Keep 28px but make it primary color instead of slate |
| **Barcode card number too small** | 12px | Increase to **14px** |
| **Field row height cramped for new size** | 46px | Increase to **52px** for 5 fields spanning the photo height |

### Revised Layout Math

Canvas: 1012x638

- Header: 116px (unchanged)
- Teal line: 4px at y=116
- Body starts: y=130 (hH + 14)
- Photo: 210x270 at x=40, y=130 → bottom at y=400
- 5 fields at rowH=52: spans 260px (130+10 to 400) — aligns with photo height
- Valid Until: y=410 (photo bottom + 10)
- Signature area: y=410-460, right-aligned
- Barcode bar: y=568 to 638 (70px) — gap between signature (~460) and barcode (568) is ~108px which is reasonable with the bigger elements

### Key Changes in `src/lib/idCardRenderer.ts`

1. **Photo**: 187x231 → **210x270**
2. **Labels**: 16px → **20px** bold, color stays `#64748b`
3. **Values**: 20px → **24px** bold
4. **Label column width**: 160 → **200px**
5. **Row height**: 46 → **52px**
6. **Card number font**: 12px → **14px**
7. **Valid Until color**: `#475569` → use `primary` color for emphasis

### File Summary

| File | Action |
|------|--------|
| `src/lib/idCardRenderer.ts` | Adjust dimensions and font sizes — photo, labels, values, row height, label column width |

Single file edit.

