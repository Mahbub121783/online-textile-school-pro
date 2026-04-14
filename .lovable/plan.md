

# True Round-Robin Model Rotation for AI Tutor

## Problem

The current `rollingProviderCall` always tries the Lovable gateway first. Since it usually succeeds, the other API keys (Groq, Mistral, etc.) never get used. The "Fibonacci balancer" only kicks in as a fallback, defeating the purpose of key rotation.

## Solution

Replace the "Lovable-first, others as fallback" logic with a true **round-robin rotation** that cycles through ALL available keys (including Lovable) on every message. The rotation order is determined by `usage_count` (lowest goes first), ensuring even distribution.

## Changes

### 1. Modify `supabase/functions/ai-tutor/index.ts`

**Remove Lovable-first priority block** (lines 102-122). Instead, treat the Lovable gateway as just another key in the rotation pool.

**New `rollingProviderCall` logic:**

1. Fetch all active keys from `ai_api_keys` table
2. Create a virtual "lovable" entry with its own usage counter (stored in a simple DB row or derived from chat history)
3. Combine all keys into one pool, sort by `usage_count` ascending (lowest usage = next in line)
4. Try the lowest-usage key first; on success, increment its `usage_count`
5. On failure, increment `error_count`, apply Fibonacci penalty, try next key

**Lovable key tracking:** Since the Lovable gateway has no row in `ai_api_keys`, add a virtual row for it:
- Insert a row with `provider = 'lovable'`, `api_key = 'LOVABLE_GATEWAY'` (placeholder — actual key comes from env var) into `ai_api_keys` via migration, or handle it in code by creating a synthetic entry merged into the pool.
- Simpler approach: handle in code — build a synthetic key object for Lovable, track its usage in the same `ai_api_keys` table.

### 2. Database Migration

Add a row to `ai_api_keys` for the Lovable gateway so its usage is tracked alongside other keys:

```sql
INSERT INTO ai_api_keys (provider, label, api_key, is_active, usage_count, error_count)
VALUES ('lovable', 'Lovable Gateway', 'ENV_MANAGED', true, 0, 0)
ON CONFLICT DO NOTHING;
```

### 3. Updated Rotation Logic (pseudocode)

```
function rollingProviderCall():
  allKeys = getAllActiveKeys(sb)  // includes lovable row
  sorted = sort by usage_count ASC (ties broken by fewer errors)
  
  for key in sorted:
    if key.provider == 'lovable':
      apiKey = Deno.env.get("LOVABLE_API_KEY")
      if !apiKey: continue
    else:
      apiKey = key.api_key
    
    endpoint = PROVIDER_ENDPOINTS[key.provider]
    model = DEFAULT_MODELS[key.provider]
    
    try call endpoint:
      on success: markKeyUsed(key.id), return response
      on rate-limit/error: markKeyError(key.id), continue
```

This ensures that with 2 keys (Lovable + Groq), messages alternate: Lovable → Groq → Lovable → Groq. With 3+ keys, it cycles through all of them evenly.

## Technical Details

- The sort-by-`usage_count` approach naturally produces round-robin behavior without needing an external counter
- Error penalty via Fibonacci weighting still applies, pushing failing keys to the back
- Auto-disable after 20 consecutive errors is preserved
- No client-side changes needed

