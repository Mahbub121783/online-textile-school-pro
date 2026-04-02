

## Plan: Advanced Real-Time Chat with Message Request System

### Current State

The chat widget exists with basic real-time (Supabase postgres_changes), direct messaging, user search, and unread badges. However:

- **No message request system** — anyone can message anyone instantly without consent
- **No online/offline status** — no presence indicators
- **No typing indicators** — no "typing..." feedback
- **No message deletion** — users can't delete messages
- **No block/report** — no safety controls
- Real-time works but only refreshes queries (not instant push to UI)

### What We'll Build

**1. Chat Request System (Accept/Decline)**
- New table `chat_requests` with status: `pending`, `accepted`, `declined`, `blocked`
- When Student A searches and clicks a user, instead of opening chat directly, it sends a **message request**
- Recipient sees pending requests tab with Accept/Decline buttons
- Only after acceptance can both users exchange messages
- Already-accepted contacts go straight to chat

**2. Online Presence & Typing Indicators**
- Use Supabase Realtime Presence to track who's online
- Green dot on avatars for online users
- "Typing..." indicator when the other user is composing

**3. Enhanced Chat Features**
- Delete own messages (soft delete with "Message deleted" placeholder)
- Block user option (prevents further messages)
- Emoji reactions (not full picker — quick react with 👍❤️😂)
- Sound notification on new message

### Database Changes

```sql
-- Chat requests table
CREATE TABLE chat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, accepted, declined, blocked
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);
ALTER TABLE chat_requests ENABLE ROW LEVEL SECURITY;

-- RLS: users see their own requests, update ones they received
CREATE POLICY "Users view own requests" ON chat_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users send requests" ON chat_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receivers update requests" ON chat_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- Add soft delete to chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
-- Add reaction support
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reactions jsonb DEFAULT '{}';
```

### Implementation

**Step 1: Migration** — Create `chat_requests` table + add `deleted_at` and `reactions` columns to `chat_messages`

**Step 2: Rewrite ChatWidget.tsx** with these views:
- **Conversations tab** — existing accepted chats
- **Requests tab** — pending incoming requests with Accept/Decline/Block
- **Sent requests** — pending outgoing requests
- Search results now show "Send Request" button instead of opening chat directly
- If request already accepted, open chat directly

**Step 3: Presence & Typing**
- Join a Supabase Realtime Presence channel on widget open
- Track online users, show green dot
- Broadcast typing state via Presence, show "typing..." bubble

**Step 4: Enhanced message features**
- Long-press/right-click message → Delete (own) or React
- Deleted messages show "This message was deleted"
- Block option in chat header → creates/updates chat_request to `blocked`
- Play notification sound on incoming message when chat is closed

### Files

| File | Action |
|------|--------|
| Migration SQL | Create `chat_requests`, alter `chat_messages` |
| `src/components/chat/ChatWidget.tsx` | Full rewrite with requests, presence, typing, reactions |

### Technical Notes
- Presence uses `supabase.channel('online-users').track({ user_id, name, avatar })` 
- Typing uses same channel with `channel.send({ type: 'broadcast', event: 'typing', payload: { userId } })`
- Chat request check before sending: query `chat_requests` for accepted status between the two users
- Block check: if status is `blocked`, hide user from search and prevent messaging
- Total: 1 migration, 1 file rewrite

