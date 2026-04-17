

User wants me to look at the **ID card signature** (not certificate — they said certificate but the image shows the Student ID card, and the recent context is about ID card settings). The signature on the ID card looks compressed/distorted.

Let me check the ID card renderer.
<lov-tool-use id="toolu_vrtx_01FV8kWRVEGiJYf89sr1vpFs" name="code--view" integration-id="code" data="{\"file_path\": \"src/lib/idCardRenderer.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Rcsm2JkcUWTCUeEzdynSLZ" name="code--view" integration-id="code" data="{\"file_path\": \"src/lib/idCardRenderer.ts\"}">
</lov-tool-use>
<lov-plan>

## The Problem

Looking at the screenshot + the code in `idCardRenderer.ts` (line 246):

```js
ctx.drawImage(sig, sigCenterX - 70, sigBaseY - 2, 140, 34);
```

The signature is **force-stretched into a fixed 140×34 box** regardless of its real dimensions. The uploaded signature `jiku_sir_sign_1.png` is roughly square (~512×512), so squashing it into a 140×34 (4.1:1) container makes the strokes look:
- horizontally stretched / squashed
- thin and broken
- offset awkwardly above the line

Additional issues:
1. No aspect-ratio preservation
2. Fixed pixel size — doesn't scale with content
3. No image smoothing hint, so downscaling from 512px → 34px destroys strokes
4. Signature sits *on* the line instead of *above* it
5. Render canvas is only 1012×638 (1x DPI), so PDF/PNG export is blurry — exporting to a 3.375" × 2.125" PDF at 300 DPI requires 1012×638×~2 to look crisp

## The Fix — Advanced Signature Renderer

Make signature rendering professional and crisp:

### 1. Aspect-ratio aware fitting (`object-fit: contain`)
```text
maxBoxW = 180, maxBoxH = 56
ratio = sig.naturalWidth / sig.naturalHeight
if ratio > boxRatio → fit by width
else                → fit by height
center horizontally on sigCenterX, sit just above the signature line
```

### 2. High-quality downsampling
- Set `ctx.imageSmoothingEnabled = true` and `ctx.imageSmoothingQuality = 'high'` before drawing the signature
- This eliminates broken / pixelated strokes when shrinking a 512px source to ~50px

### 3. 2× resolution canvas for crisp export
- Render at `CARD_W*2 × CARD_H*2` (2024×1276) internally
- Scale all coordinates uniformly via `ctx.scale(2,2)`
- Result: exported PNG/PDF is twice as sharp, signature edges stay smooth

### 4. Proper vertical placement
- Signature **above** the line, baseline touching the line (with 4px padding), not overlapping
- Authority name + position positioned relative to the line, not the signature

### 5. Larger signature box
- Increase max box from 140×34 to **180×56** so signatures with tall ascenders/descenders (like the uploaded one with the loop & tail) aren't clipped or shrunk to invisibility

### 6. Optional contrast boost
- Apply a subtle `filter: contrast(1.15)` while drawing the signature so faint strokes from photographed signatures stay bold

## Files to Change

| File | Change |
|---|---|
| `src/lib/idCardRenderer.ts` | Rewrite signature drawing block (lines ~239–270) with aspect-fit + high-quality smoothing. Add 2× DPR rendering wrapper. Adjust signature line + authority text positions to align with the new fitted signature. |

## Result

- Signature renders at its true aspect ratio — no more horizontal squash
- Crisp strokes at any export size (PNG, PDF, on-card preview)
- Signatures of any shape (square, wide, tall) all fit cleanly above the line
- 2× resolution = print-quality output

