

# Fix Both Chat Systems

## Root Causes Found

### 1. AI Tutor Bubble: Off-Screen Due to Negative Default Position
In `AiTutorWidget.tsx` line 13, the default position is `{ x: 24, y: -96 }`. Since `y` maps to `bottom` in CSS, `bottom: -96px` renders the bubble **below the viewport** — completely invisible. Should be `96` (positive).

Additionally, any user who visited the page while this bug was active will have the bad position saved in localStorage under `ai-tutor-pos`, so even fixing the default won't help them until we add a sanity check on stored values.

### 2. Both Widgets: Auth Gate
Both widgets return `null` when no user is logged in (`if (!user) return null`). This is by design, but worth noting — you must be logged in to see them.

### 3. ChatWidget Position Overlap
The ChatWidget button sits at `right-4 bottom-20` which is correct. But the chat panel uses `lg:bottom-22` which is not a standard Tailwind class (Tailwind has `bottom-20`, `bottom-24`, but not `bottom-22`). This could cause layout issues on desktop.

## Changes

### File: `src/components/chat/AiTutorWidget.tsx`
- Fix `DEFAULT_POS` from `{ x: 24, y: -96 }` to `{ x: 24, y: 96 }`
- Add validation in `getStoredPos()` to reject negative or out-of-bounds stored values (fixes users with corrupted localStorage)
- Ensure the chat panel z-index is `z-[9999]` to match the bubble

### File: `src/components/chat/ChatWidget.tsx`
- Fix `lg:bottom-22` to `lg:bottom-24` (valid Tailwind class)
- Ensure the chat button doesn't overlap with the AI Tutor bubble (keep it on the right side, AI Tutor on the left)

