

# Advanced AI Tutor System Upgrade

## Summary
Major overhaul of the AI chatbot: draggable transparent bubble, multi-key rolling API system, deep database indexing, conversation persistence for auto-learning, and advanced textile knowledge engine.

---

## What Gets Built

### 1. Draggable Transparent Bubble (Widget)
- Bubble becomes 20% opacity, positioned above bottom nav (bottom-20 on mobile)
- Drag-to-move via mouse/touch events with position persistence in localStorage
- When chat panel opens, it becomes fully opaque
- Works on both desktop and mobile without overlapping bottom nav

### 2. Database: API Keys Pool + Chat History Tables

**New table: `ai_api_keys`** - stores multiple API keys per provider for rolling rotation
- `id`, `provider` (groq/gemini/openai/mistral), `api_key`, `label`, `is_active`, `usage_count`, `last_used_at`, `last_error`, `created_at`
- RLS: admin only

**New table: `ai_chat_history`** - stores every message for future learning
- `id`, `session_id` (FK to ai_chat_sessions), `user_id`, `role`, `content`, `provider_used`, `model_used`, `tokens_used`, `response_time_ms`, `created_at`
- Indexed on `user_id`, `session_id`, `created_at`
- RLS: users see own, admins see all

**New table: `ai_search_index`** - structured index of all platform content
- `id`, `entity_type` (course/lesson/ebook/quiz/assignment/event), `entity_id`, `title`, `content_summary`, `keywords` (text[]), `metadata` (jsonb), `search_vector` (tsvector), `updated_at`
- GIN index on search_vector and keywords
- RLS: authenticated read

### 3. Edge Function: Rolling API Key System + Deep Indexing

**Rolling key selection:**
- Fetch all active keys for the resolved provider from `ai_api_keys`
- Pick the least-recently-used key (round-robin by `last_used_at`)
- On 429/error, mark key with `last_error`, try next key automatically
- Fallback chain: try up to 3 keys before returning error
- If provider is "lovable", use LOVABLE_API_KEY (no rotation needed)

**Deep database context:**
- Query `ai_search_index` using full-text search on the user's question
- Inject top-5 matching results as context alongside student-specific data
- Include courses, lessons, ebooks, quizzes, assignments, events content

**Conversation persistence:**
- Save every message to `ai_chat_history` with provider/model/timing metadata
- Auto-create/update `ai_chat_sessions` for the user

**Enhanced system prompt:**
- Add textile math/calculation capabilities instruction
- Add structured response formatting for calculations

### 4. Admin Dashboard Upgrades (`AdminAiChatbot.tsx`)

**New tab: "API Keys"**
- Add/remove/toggle multiple keys per provider
- Shows usage count, last used, last error status
- Visual health indicator per key

**New tab: "Search Index"**
- Shows indexed content counts by entity type
- "Rebuild Index" button that triggers re-indexing edge function
- Preview indexed entries

**Enhanced "Chat Sessions" tab:**
- Shows provider used, response time, token usage per message
- Export chat history

### 5. Search Index Builder (Edge Function: `ai-index-builder`)

- New edge function that scans courses, lessons, ebooks, quizzes, assignments, events
- Builds/refreshes `ai_search_index` entries with tsvector for full-text search
- Called manually from admin or on content changes

### 6. Widget Enhancements
- Session persistence: save/restore chat from `ai_chat_sessions`
- Show which provider/model answered each message
- Quick prompts become context-aware based on user's courses

---

## Technical Details

### Files Created
- `supabase/migrations/[timestamp]_ai_advanced.sql` - new tables + indexes
- `supabase/functions/ai-index-builder/index.ts` - content indexer

### Files Modified
- `src/components/chat/AiTutorWidget.tsx` - draggable, transparent, session persistence, history saving
- `supabase/functions/ai-tutor/index.ts` - rolling keys, deep indexing context, history persistence
- `src/pages/admin/AdminAiChatbot.tsx` - API keys tab, search index tab
- `src/integrations/supabase/types.ts` - new table types

### Key Architecture Decisions
- Rolling keys use `ORDER BY last_used_at ASC LIMIT 1` for simple round-robin
- Search index uses PostgreSQL tsvector/GIN for fast full-text search (no external service needed)
- Chat history stored per-message (not JSONB array) for queryability and future ML training
- Bubble position stored in localStorage as `{x, y}` coordinates
- All API keys stored encrypted-at-rest in Supabase (admin-only RLS)

