## Goal

Question Bank-er AI question generation **admin-er nijer API key** theke chalano, Lovable AI shudhu optional fallback. AI shudhu admin-er kaaj-e use hobe (bulk generate kore DB-te store), end user-er upor kono AI call hobe na.

## Architecture

```text
Admin clicks "Generate"
        ↓
Edge Function: qb-ai-generate
        ↓
Read provider config from `qb_ai_settings` table
        ↓
   ┌────────────────┬───────────────┐
   │  Primary: Groq │  Mistral      │  OpenRouter  (admin choice)
   │  /Custom       │               │
   └────────┬───────┴───────┬───────┘
            ↓ (on failure)
        Lovable AI (optional fallback if enabled)
            ↓
   Validate JSON → Insert into qb_questions (source='ai')
```

## 1. Database — new admin settings table

`qb_ai_settings` (single-row config, admin-only RLS):

| column | type | purpose |
|---|---|---|
| `id` | uuid PK | always single row |
| `provider` | text | `'groq' \| 'mistral' \| 'openrouter' \| 'openai' \| 'lovable'` |
| `model` | text | e.g. `llama-3.3-70b-versatile`, `mistral-large-latest`, `google/gemini-2.0-flash-exp:free` |
| `fallback_enabled` | boolean | true → fallback to Lovable AI |
| `fallback_provider` | text | default `'lovable'` |
| `fallback_model` | text | default `'google/gemini-2.5-flash'` |
| `temperature` | numeric | default `0.7` |
| `max_questions_per_run` | int | default `25` (safety cap) |
| `system_prompt_override` | text nullable | optional custom prompt |

RLS: SELECT/UPDATE only for `admin` + `super_admin`. API keys **never stored here** — only provider name + model. Actual keys are in Supabase secrets.

## 2. Secrets to add

Admin will add **only** the keys for the provider(s) they want:
- `GROQ_API_KEY` (recommended — free tier, fast)
- `MISTRAL_API_KEY` (free tier available)
- `OPENROUTER_API_KEY` (multi-model, has free models)
- `OPENAI_API_KEY` (optional)

`LOVABLE_API_KEY` already set → fallback automatically works.

## 3. Edge Function — `qb-ai-generate`

Single function, provider-agnostic:

- Auth: requires logged-in user with `admin`/`super_admin`/`instructor` role (validated via `getClaims` + `qb_is_staff` RPC)
- Input (Zod validated): `{ subject_id, topic_id?, difficulty, count (1–25), language ('en'|'bn'), question_type }`
- Reads `qb_ai_settings` for provider config
- Builds OpenAI-compatible chat completion request:
  - **Groq**: `https://api.groq.com/openai/v1/chat/completions`
  - **Mistral**: `https://api.mistral.ai/v1/chat/completions`
  - **OpenRouter**: `https://openrouter.ai/api/v1/chat/completions`
  - **OpenAI**: `https://api.openai.com/v1/chat/completions`
  - **Lovable**: `https://ai.gateway.lovable.dev/v1/chat/completions`
- Uses **structured tool-calling** (JSON schema) so output is always valid
- Schema enforces: `question_text`, `options[]`, `correct_answer`, `explanation`, `difficulty`, `points`
- On any provider failure → if `fallback_enabled`, retry with Lovable AI; else return error
- Returns draft questions (NOT auto-inserted) → admin reviews → bulk approves

## 4. Admin UI changes (`AdminQuestionBank.tsx`)

Add new tab **"AI Settings"**:
- Provider dropdown (Groq / Mistral / OpenRouter / OpenAI / Lovable)
- Model name input (free text — placeholder shows recommended free models per provider)
- Temperature slider
- Fallback toggle + fallback model
- Status indicator: shows which API keys are configured (✓/✗) by checking edge function endpoint
- "Test Connection" button → calls function with `count=1`

Existing **"AI Generator"** tab:
- Generate → Review draft list → admin can edit each question → "Approve & Save" → inserts into `qb_questions` with `source='ai'`
- No AI runs anywhere else in the app (no student-facing AI for the question bank)

## 5. Client safety

- AI generation route is admin-only (sidebar link gated by role)
- No frontend code calls AI providers directly — always through edge function
- Generated questions go to `qb_questions` table → from then on, exam runner just reads from DB (zero AI calls during student exam)

## 6. Free model recommendations (shown in UI as hints)

| Provider | Free model |
|---|---|
| Groq | `llama-3.3-70b-versatile` |
| Mistral | `mistral-small-latest` |
| OpenRouter | `google/gemini-2.0-flash-exp:free`, `meta-llama/llama-3.3-70b-instruct:free` |
| Lovable (fallback) | `google/gemini-2.5-flash` |

## What I need from you before building

1. **Confirm provider** — Groq/Mistral/OpenRouter/OpenAI? (Groq + OpenRouter are best for free tier)
2. After plan approval, I will trigger `add_secret` for the chosen provider's API key. Tumi tokhon key paste korbe (Groq: https://console.groq.com/keys, OpenRouter: https://openrouter.ai/keys).

## Out of scope (this iteration)

- Per-question AI explanations on result page (purely DB-driven)
- AI-based question difficulty auto-tagging
- Per-user AI tutor chat in Question Bank
