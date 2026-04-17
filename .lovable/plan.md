

## Goal

Wrap the `SecureMediaPlayer` in a sleek, modern **theatre-style frame** (like the screenshot): rounded dark container, padded gutters, a top header bar showing video title + source badge, the video itself centered with side breathing room, and a refined bottom footer with playback controls + meta info. Works identically on mobile and desktop.

## Design Reference (from the screenshot)

```text
┌─ rounded dark frame ────────────────────────────────┐
│  [▶ Drive]   Lesson Title Here          [⋮ menu]    │ ← Header
├─────────────────────────────────────────────────────┤
│                                                     │
│              ▶ video (16:9, padded)                 │
│                                                     │
├─────────────────────────────────────────────────────┤
│  ◀◀  ▶  ▶▶   01:23 / 12:45   ━━●━━━━   🔊 ⚙ ⛶     │ ← Footer
└─────────────────────────────────────────────────────┘
```

## Implementation

### New wrapper: `src/components/media/PlayerShell.tsx`
A presentation-only wrapper with three slots: `header`, `children` (video), `footer`.

- Outer: `rounded-2xl bg-gradient-to-b from-zinc-900 to-black p-2 sm:p-3 md:p-4 shadow-2xl ring-1 ring-white/10`
- Header strip: 44px tall, flex row (left: source badge + title, right: optional menu/info), `border-b border-white/5`
- Video slot: `rounded-xl overflow-hidden bg-black aspect-video` — keeps the 16:9 ratio with side breathing room from the frame padding
- Footer strip: 56px tall, hosts the existing controls (progress bar + play/skip/volume/fullscreen) — pulled OUT from the video overlay into a permanent footer

### Refactor `SecureMediaPlayer.tsx`

1. **Extract controls** out of the absolute-positioned overlay into a `<PlayerFooter>` block (always visible, not auto-hiding) — gives that "real player" feel like the screenshot.
2. **Header bar**: source badge (left) + title (center, truncated) + 3-dot menu (right) for playback speed / quality / etc.
3. **Mobile**: shell padding shrinks to `p-2`, header/footer stay; controls reflow (volume hidden, time compact). At `<400px`, badge moves to icon-only.
4. **Fullscreen mode**: shell auto-removes padding & rounded corners → goes edge-to-edge; header/footer overlay on top of video with auto-hide (current behavior).
5. **Direct videos**: keep custom HTML5 controls in the footer.
6. **Embedded (YouTube/Vimeo/Drive)**: footer shows source name + "Controls inside player" hint + fullscreen button only (since we can't seek across origins).

### Visual polish
- Header & footer use `bg-zinc-950/80 backdrop-blur` for that premium glass look
- Smooth `transition-all` on shell padding when entering/exiting fullscreen
- Subtle gradient ring around the video slot
- Consistent `text-xs` for metadata, `tabular-nums` for time

## Files

| File | Change |
|---|---|
| `src/components/media/PlayerShell.tsx` | **NEW** — presentation wrapper (header / video slot / footer) |
| `src/components/media/SecureMediaPlayer.tsx` | Wrap output in `<PlayerShell>`, move controls to permanent footer, add header bar with title + source badge + menu, handle fullscreen padding collapse |

## Result
- All lessons (Direct upload, YouTube, Vimeo, Drive) get the same elegant framed look
- Side gutters give the video breathing room (no more edge-to-edge harshness)
- Header always shows what's playing; footer always shows controls
- Identical experience mobile ↔ desktop, just scales padding & hides non-essential controls on small screens
- Fullscreen still goes edge-to-edge for immersive viewing

