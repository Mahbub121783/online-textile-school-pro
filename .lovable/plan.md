## Problem

The floating "Messages" panel (`src/components/chat/ChatWidget.tsx`) header currently shows only an icon + "Messages" title. There is no visible **minimize** or **close (X)** button inside the panel. Users have to find the small floating bubble (which turns into an X) to dismiss it — which is hidden behind the panel on small viewports and not obvious.

## Plan

### Part A — Fix the missing controls (core fix)

1. Add a control cluster on the **right side of the panel header** (line 816 area):
   - **Minimize** button (`Minus` icon) → closes the panel but keeps the floating bubble & unread badge in place. Same as `setOpen(false)`.
   - **Close** button (`X` icon) → closes the panel AND hides the bubble for the rest of the session (`sessionStorage` flag `chat_widget_dismissed`). A small "Show chat" pill reappears after 30s or on next page load.
   - **Expand / Fullscreen toggle** (`Maximize2` / `Minimize2`) → on desktop, expands panel to ~720×640 instead of 384×480.

2. Mirror the same control on the **conversation sub-header** (line 691) and **AI Tutor sub-header** (line 155) so users can always close from any sub-view, not only the contact list.

3. Mobile: since the panel is full-screen (`inset-2`), the close X is essential. Make the header tap targets ≥36px and add `aria-label`s.

4. Keyboard: bind **Esc** to minimize the panel when open.

### Part B — Advanced upgrades (opt-in improvements)

1. **Sound + browser notification on new message**
   - Play a soft chime (small base64 wav) when a new `chat_messages` row arrives for the user and the panel is closed or on a different tab.
   - Use the Web Notifications API (with permission prompt) for desktop pop-ups; click focuses the conversation.

2. **Search inside Chats tab**
   - The `search` state already exists but is unused. Wire it to a small input above the conversation list to filter by name / last message.

3. **Per-conversation draft persistence**
   - Save the unsent input per `selectedUser.userId` to `localStorage` so switching contacts doesn't lose typing.

4. **Unread separator + "Jump to latest" pill**
   - Insert a "─ New messages ─" divider above the first unread message; show a floating "↓ N new" button when scrolled up.

5. **Quick emoji reactions in input bar**
   - Add a small 👍 / ❤️ / 😂 picker next to the Send button (uses existing `REACTIONS` array).

6. **Online presence dot on bubble**
   - Tiny green dot on the floating bubble when any contact is online.

7. **Reduce bubble friction**
   - Snap-to-edge after drag (left or right edge, whichever is closer).
   - Auto-fade to 30% opacity after 4s of no interaction.

8. **AI Tutor: copy + regenerate**
   - "Copy" button on assistant messages.
   - "Regenerate" button when the last message is from assistant.

### Part C — Optional (ask before doing)

- File / image attachments in 1-to-1 chat (needs Cloudinary upload wiring).
- Voice notes (MediaRecorder → R2).
- Read receipts (✓✓) — schema already has `is_read`.

These three are larger; I'll only build them if you say yes.

## Files to change

| File | Change |
|---|---|
| `src/components/chat/ChatWidget.tsx` | Header control cluster, Esc key, fullscreen state, search wiring, draft persistence, sound, snap-to-edge, copy/regenerate, unread divider |
| `public/sounds/chime.mp3` (new, ~3 KB) | Notification sound |

No DB migrations needed for Part A + B.

## Result

- Clear **minimize**, **close**, and **expand** buttons in every chat header.
- Esc to dismiss; mobile-friendly tap targets.
- Optional advanced UX (sound, search, drafts, fullscreen, snap-to-edge, copy/regenerate) layered on top without breaking existing flows.

Approve and I'll implement Part A + B. Tell me which items in Part C (if any) to include.