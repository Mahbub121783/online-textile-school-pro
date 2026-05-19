## Plan

### 1. Seed 800 new practice questions
Run the 4 pre-generated SQL chunks (`/tmp/qb_sql/chunk_00..03.sql`, 200 rows each) as one migration appending to `qb_questions` for the 4 new subjects (Spinning, Weaving, Knitting, Garments Technology). Existing questions remain untouched — these are purely additive. Each subject ends up with 80 basic / 80 intermediate / 40 advanced MCQs.

### 2. Fix payment failure for Practice Credits
**Root cause:** `order_items.item_type` has a CHECK constraint allowing only `'course'` and `'ebook'`. When buying practice credit tokens, `Checkout.tsx` inserts `item_type: 'tokens'`, which violates the constraint and aborts the order — hence the toast `order_items violates check constraint order_items_item_type_check`.

**Fix (migration):**
- `ALTER TABLE public.order_items DROP CONSTRAINT order_items_item_type_check;`
- Re-add it as `CHECK (item_type IN ('course','ebook','tokens'))`.

After this, the existing `process-payment` edge function flow (which already credits `user_token_balance` on `tokens` orders) will complete successfully.

### 3. Make credit/token balance visible
Surface the user's current Practice Credits in the global header so it's always discoverable:
- Use the existing `useTokenBalance` hook.
- Add a compact pill in the user/navigation header (next to Cart / Notifications): coin icon + balance number, clickable → `/practice/credits`.
- Show only when user is logged in. Hide on mobile if space tight (or show icon-only).
- Also add a small "Your balance: X credits" summary card at the top of `/practice` (PracticeHome) and `/practice/credits` pages for clarity.

No new tables, no RLS changes.

### Files touched
- New migration: relax `order_items_item_type_check` + bulk INSERT 800 questions.
- `src/components/layout/Header.tsx` (or equivalent navigation header) — add credit pill.
- `src/pages/practice/PracticeHome.tsx` — add balance summary card.

### Verification
- `SELECT subject_id, difficulty, COUNT(*) FROM qb_questions GROUP BY 1,2` → confirms 80/80/40 per new subject.
- Buy 100 credits via bKash on `/cart/checkout` → order completes, no constraint error, balance increases.
- Header shows updated credit count after purchase.