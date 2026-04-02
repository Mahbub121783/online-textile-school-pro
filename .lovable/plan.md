

## Plan: Redesign Forum Layout — Remove Points Info, Add Leaderboard Tab, Improve Responsiveness

### Changes to `src/pages/forum/ForumHome.tsx`

**Remove:**
- The entire "How Points Work" sidebar card (lines 258-266)
- The permanent sidebar leaderboard card (lines 236-256)

**Add:**
- A small "Top Contributors" tab/button in the header area (next to "New Post") that opens a Sheet/Drawer showing the full leaderboard with points
- On mobile: Sheet slides up from bottom; on desktop: Sheet slides from right

**Layout Improvements:**
- Remove the 2-column `md:flex-row` layout since sidebar is gone — posts take full width
- Search bar and category tabs get better spacing
- Post cards become more interactive: subtle border-left color accent, better hover states with scale transform
- Category tabs use `ScrollArea` horizontal scroll on mobile instead of wrapping
- Post metadata (comments, reactions, views) uses icon buttons style for cleaner look
- Empty state gets a larger illustration-style message

### File Changes

| File | Change |
|------|--------|
| `src/pages/forum/ForumHome.tsx` | Remove sidebar, add leaderboard Sheet trigger button, full-width posts, responsive improvements |

### Technical Details
- Use shadcn `Sheet` component for the leaderboard drawer
- Leaderboard query stays the same, just rendered inside Sheet content
- Single file edit, no new files or migrations needed

