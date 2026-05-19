# Practice Arena: Negative Marking + Token / Credit System

## 1. Negative marking (per question)

Penalty as a **percentage of that question's `points`**, applied only when a user submits a **wrong** answer (blank/skipped = 0, no penalty).

| Difficulty   | Penalty per wrong |
|--------------|-------------------|
| basic        | −15%              |
| intermediate | −20%              |
| advanced     | −25%              |

- Applied inside `qb_submit_exam` using the session's `difficulty`.
- Final `score` is floored at 0 (never negative); `percentage = score / total_points * 100`.
- XP unchanged in shape but only counts correct answers (existing formula already does this).
- New column `qb_exam_answers.penalty_points int default 0` (cheap, no per-row update of `qb_questions`).
- Result page shows: Correct, Wrong (−X pts), Skipped, Net Score.

## 2. Daily token system (free users)

Single shared daily pool of **20 tokens / day**.

| Exam type         | Cost per exam |
|-------------------|---------------|
| Mixed (all dept)  | 10 tokens     |
| Department exam   | 5 tokens      |

→ free user can do 2 mixed, or 4 dept, or any combo summing ≤ 20.

New table `qb_user_tokens`:
- `user_id uuid PK`
- `daily_balance int` — auto-refills to 20 on first use of a new day (lazy refill, no cron → free-tier friendly)
- `paid_balance int default 0` — purchased credits, never expire
- `last_refill_date date`
- `updated_at`

Spending order on exam start: **daily first, then paid**. Unused daily tokens **do not carry over** (reset on next-day first call) — matches "existing remove hobe jodi free user hoy".

Implementation:
- New RPC `qb_consume_tokens(_cost int)` — `SECURITY DEFINER`, does refill-if-stale + atomic debit, raises `'insufficient_tokens'` when neither bucket covers `_cost`. Wrapped in a single `UPDATE ... RETURNING` for concurrency safety.
- `qb_start_exam` calls it with cost = 5, `qb_start_mixed_exam` with cost = 10, **before** inserting the session. If it fails, no session is created.
- New helper RPC `qb_get_token_status()` → `{daily_balance, paid_balance, refills_at}` for the UI badge.

Admins/instructors bypass via existing `qb_is_staff()`.

## 3. Purchasable credits (paid_balance)

- Price: **100 credits = 50 BDT** → 0.5 BDT / credit. Any quantity ≥ 100 (step of 100).
- Reuses existing cart + checkout flow.

Cart changes (`src/stores/cartStore.ts`):
- Extend `CartItem.type` to `'course' | 'ebook' | 'practice_credits'`.
- New optional field `credits?: number` (for the credit pack).

Checkout changes (`src/pages/cart/Checkout.tsx`):
- Skip course-only side effects (enrollment, instructor revenue share, installment plans) for `practice_credits` items.
- After order completes, for each `practice_credits` item call new RPC `qb_credit_paid_tokens(_credits int, _order_id uuid)` which adds to `paid_balance` and writes an `admin_activity_log`-style row in a new `qb_token_ledger` (id, user_id, delta, reason, ref_id, created_at) for auditing/refunds.
- Wallet & free-order paths reuse the same crediting call (already wrapped in try/catch per recent hardening).

Order line storage:
- `order_items` already stores `item_type` + `item_id` + price; for credits, `item_type='practice_credits'`, `item_id = <pack uuid>`, store `credits` in the existing `meta` jsonb (or `quantity` field if present — confirmed during implementation by reading the table).

## 4. UI

- **`PracticeHome.tsx`**: token badge in hero ("Tokens: 15 daily · 200 paid"), buy-credits CTA, disable start buttons + tooltip when insufficient.
- **`PracticeSubject.tsx`**: show cost (5) on each Start button, same disabled state.
- **New page `src/pages/practice/PracticeCredits.tsx`** at `/practice/credits`:
  - Pack picker (100, 500, 1000, 2500, custom) → adds to cart and routes to `/checkout`.
  - Shows current balances + last 10 ledger rows.
- **`PracticeResult.tsx`**: show net score breakdown (correct +X, wrong −Y, net = Z).
- **`PracticeExam.tsx`**: small "Penalty: −15%/wrong" chip in the header so users know before answering.
- New hook `useTokenBalance()` (1-min stale, no realtime → free-tier friendly).

## 5. Free-tier / performance considerations

- All new logic lives in 1 table (`qb_user_tokens`, 1 row/user) + 1 small ledger; lazy refill avoids any cron job.
- No new triggers on hot tables; reuses existing `qb_submit_exam` (one extra column write).
- Token RPCs are tiny single-row updates → negligible CPU.
- UI queries: 1 extra row fetch per home page mount, cached 60 s.

## 6. Files touched

```
DB migration (single file)
  - alter qb_exam_answers add penalty_points
  - create table qb_user_tokens
  - create table qb_token_ledger
  - rpc qb_consume_tokens, qb_get_token_status, qb_credit_paid_tokens
  - replace qb_submit_exam (add negative marking)
  - replace qb_start_exam / qb_start_mixed_exam (call qb_consume_tokens)
  - RLS: users read own rows; SECURITY DEFINER RPCs handle writes

Frontend
  - src/stores/cartStore.ts                 (extend type + credits field)
  - src/pages/cart/Checkout.tsx             (skip course-only steps for credits; call credit RPC)
  - src/pages/practice/PracticeHome.tsx     (token badge, disable states, link to /practice/credits)
  - src/pages/practice/PracticeSubject.tsx  (cost label + disabled state)
  - src/pages/practice/PracticeExam.tsx     (penalty chip)
  - src/pages/practice/PracticeResult.tsx   (net score breakdown)
  - src/pages/practice/PracticeCredits.tsx  (new)
  - src/hooks/useTokenBalance.ts            (new)
  - src/App.tsx                             (route /practice/credits)
```

## 7. Out of scope (confirm before adding)

- No refunds on credits (paid_balance is final).
- Admin UI to gift/adjust tokens — can be added later via the same `qb_token_ledger`.
- No SMS/email on low balance.
