

## Plan: Advanced Ebook Reader — PDF Page Labels, Text Layer, Highlights, Notes & Security

### Problems from Screenshot

| Issue | Detail |
|-------|--------|
| **Page mismatch** | PDF content shows "3 \| Page" but reader shows page 7 — PDF has cover/TOC pages before content numbering starts. Reader uses raw page index, not PDF's internal page labels |
| **No text interaction** | Canvas-only rendering — no text selection, no highlighting, no word-level notes |
| **Security gaps** | No screenshot protection (CSS), no visibility API pause, no watermark overlay |
| **Notes are page-level only** | Cannot attach notes to specific text/words |

### Implementation

**1. Use PDF page labels instead of raw index**
- PDF.js supports `pdf.getPageLabels()` which returns the document's own page numbering (e.g., "i", "ii", "1", "2", "3")
- Display the PDF's label in the bottom bar while keeping internal index for navigation
- Show both: "Page 3 (7/54)" — label first, then position

**2. Add text layer for highlighting and selection**
- Render a transparent `textLayer` div on top of the canvas using `pdfjsLib.renderTextLayer()`
- This enables text selection (controlled), highlighting, and word-level interaction
- Import `pdfjs-dist/web/pdf_viewer.css` for proper text layer styling
- Text layer is invisible but selectable — text appears to be on the canvas but is actually in DOM elements

**3. Text highlighting system**
- When user selects text on the text layer, show a floating toolbar: "Highlight" (yellow/green/blue/pink) + "Add Note"
- Store highlights as `{ id, page, startOffset, endOffset, text, color, note?, createdAt }`
- Save highlights in `ebook_reading_progress.notes` JSON field (reuse existing column, extend schema)
- Re-apply highlights on page render by matching text offsets
- Highlights persist across sessions

**4. Word-based note system**
- Extend the highlight flow: after highlighting, user can attach a note to that highlight
- Notes panel shows all highlights+notes grouped by page
- Click a note → jumps to that page and scrolls to the highlight
- Each highlight can have an inline note icon that expands on click

**5. Enhanced DRM / security**
- **Screenshot deterrence**: Add a semi-transparent watermark overlay with user email/ID rendered diagonally across the page (very light, ~3% opacity) — makes screenshots traceable
- **Visibility API**: Pause/blur content when tab loses focus (`document.visibilitychange`)
- **CSS screenshot blocking**: Apply `-webkit-user-select: none` and `pointer-events: none` on canvas; use CSS `filter` tricks
- **Print CSS**: Already blocks printing — keep `@media print { display: none }`
- **Block Ctrl+Shift+S, PrtScn detection**: Expand key blocker to cover more screenshot shortcuts
- **Watermark on canvas**: Render user email diagonally across each page at 3% opacity directly on the canvas — survives any screenshot attempt
- **Block drag**: Prevent image drag from canvas

**6. Disable copy but allow controlled highlight**
- Text layer allows highlighting but blocks clipboard copy (`oncopy` preventDefault)
- Selection is visual only — for note-taking purposes, not extraction
- Ctrl+C / Cmd+C blocked on the reader

### Technical Details

**Page labels**: `pdf.getPageLabels()` returns `string[]` or `null`. If available, map index to label. Display logic:
```
Label "3" at index 6 → "Page 3 (7 of 54)"
```

**Text layer rendering**: After canvas render, call:
```typescript
const textContent = await page.getTextContent();
pdfjsLib.renderTextLayer({
  textContentSource: textContent,
  container: textLayerDiv,
  viewport: scaledViewport,
});
```

**Highlight storage** — extend the existing `notes` JSON in `ebook_reading_progress`:
```typescript
interface Highlight {
  id: string;
  page: number;
  text: string;
  color: 'yellow' | 'green' | 'blue' | 'pink';
  ranges: { startOffset: number; endOffset: number; startContainer: number; endContainer: number }[];
  note?: string;
  createdAt: string;
}
```

**Watermark**: After `page.render()`, draw user email diagonally on canvas at 3% opacity using `ctx.globalAlpha = 0.03`.

### File Summary

| File | Action |
|------|--------|
| `src/pages/ebooks/EbookReader.tsx` | Major rewrite — add text layer, page labels, highlight system, word notes, enhanced DRM, watermark |

Single file change. No migration needed — highlights stored in existing `notes` JSON column.

