

# Merge AI Tutor into Chat Widget & Fix Visibility

## Problem
Both the ChatWidget (person-to-person messaging) and AiTutorWidget (AI chatbot) are invisible because:
1. **ChatWidget**: Returns `null` when no user is logged in (`if (!user) return null` at line 346). Since you're on the homepage without logging in, nothing renders.
2. **AiTutorWidget**: Same auth gate (`if (!user) return null` at line 79). Also has two separate floating bubbles competing for space.
3. **Two separate widgets** create confusion and overlap issues.

## Solution
Merge the AI Tutor into the existing ChatWidget as an **"AI Tutor" tab**, and remove AiTutorWidget entirely. The unified widget will be visible to everyone (per your preference), with the AI tab available to all visitors and the Messages tabs requiring login.

## Changes

### 1. Remove AiTutorWidget (`src/App.tsx`)
- Remove `import AiTutorWidget` and `<AiTutorWidget />` from App.tsx
- Only `<ChatWidget />` remains

### 2. Delete `src/components/chat/AiTutorWidget.tsx`
- No longer needed since AI is integrated into ChatWidget

### 3. Rewrite ChatWidget (`src/components/chat/ChatWidget.tsx`)
**Visibility fix:**
- Remove `if (!user) return null` gate
- Widget bubble shows for everyone (matching reference image: teal circle with chat icon)
- z-index set to `z-[9999]` to ensure visibility above all elements

**New "AI Tutor" tab:**
- Add a 4th tab: `AI Tutor` (with Bot icon) alongside Chats, Requests, Sent
- AI tab is available to everyone, even guests
- Chats/Requests/Sent tabs show login prompt if not authenticated
- AI tab contains the full AI Tutor UI: streaming chat, quick prompts, markdown rendering, clear history

**Tab structure when open:**
```text
[AI Tutor] [Chats] [Requests] [Sent]
     ^         ^        ^        ^
  Everyone   Login   Login    Login
             needed  needed   needed
```

**Bubble styling (matching reference image-64):**
- Single teal/dark circle at bottom-right
- `fixed bottom-6 right-6 z-[9999]`
- Unread badge shows message count
- No dragging complexity -- simple fixed position

**AI chat features preserved:**
- Streaming responses via ai-tutor edge function
- ReactMarkdown rendering
- Quick textile prompts
- Clear chat button
- Loading animation

### 4. No database changes needed
All existing tables (ai_chat_history, ai_search_index, ai_api_keys) remain intact.

## Files
| File | Action |
|------|--------|
| `src/App.tsx` | Remove AiTutorWidget import and usage |
| `src/components/chat/AiTutorWidget.tsx` | Delete |
| `src/components/chat/ChatWidget.tsx` | Add AI Tutor tab, remove auth gate, fix z-index |

