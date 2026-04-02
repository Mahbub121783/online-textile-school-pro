

## Plan: Fix ID Card Auto-Generation on Paid Enrollment

### Root Cause

The `student_id_cards` table is empty despite the student having 3 paid enrollments (all with `payment_id` set). The ID card is **never auto-generated** — it only exists as a manual admin action in `IdCardAdminControls`. There is no trigger anywhere in the payment flow, enrollment flow, or student-facing code that creates the card.

### Fix Strategy

Make the `StudentIdCard` component self-healing: when it detects the student has paid enrollments but no ID card, it auto-generates one. Additionally, trigger ID card creation/update after successful payment verification.

### Changes

#### File 1: `src/components/student/StudentIdCard.tsx`

Add auto-generation logic:
- Query paid enrollments (`enrollments` where `payment_id IS NOT NULL`) for the target user
- If paid enrollments exist but no `idCard` record, automatically create one:
  - Calculate `valid_until` = now + (6 months × paid enrollment count)
  - Generate `card_number` = `OTS-ID-XXXXXX`
  - Insert into `student_id_cards`
  - Refetch the card query
- This makes it self-healing — any student with paid courses will get their card on first view

#### File 2: `src/pages/payment/PaymentSuccess.tsx`

After payment verification succeeds (`status === 'success'`):
- Call a helper function that checks if the logged-in user has an ID card
- If not, create one; if yes, recalculate `valid_until` based on total paid enrollments
- This ensures the card is generated/extended immediately after purchase

#### File 3: `src/hooks/useEnrollments.ts` (or inline in PaymentSuccess)

Add a reusable `ensureStudentIdCard(userId)` function:
- Count paid enrollments for the user
- If count > 0: upsert into `student_id_cards` with calculated validity
- This function can be called from both PaymentSuccess and StudentIdCard

### Implementation Detail

```
ensureStudentIdCard(userId):
  1. SELECT enrollments WHERE user_id = userId AND payment_id IS NOT NULL
  2. If count = 0, return (no paid courses)
  3. SELECT student_id_cards WHERE user_id = userId
  4. months = count × 6
  5. valid_until = earliest enrolled_at + months (or now + months if no card)
  6. If no card: INSERT with new card_number, valid_from = earliest enrollment date
  7. If card exists: UPDATE valid_until only if new value is greater
```

### File Summary

| File | Change |
|------|--------|
| `src/components/student/StudentIdCard.tsx` | Add auto-generation on mount when paid enrollments exist but no card |
| `src/pages/payment/PaymentSuccess.tsx` | Call ensureStudentIdCard after successful payment |
| `src/lib/idCardRenderer.ts` | No changes needed (renderer works fine) |

No migration needed — tables and RLS policies already exist and support student self-insert (students can view their own cards, and the existing RLS allows authenticated inserts... actually need to check this).

**RLS Check**: The `student_id_cards` table only has policies for student SELECT and admin ALL. Students cannot INSERT their own card. This needs a new migration to add a student INSERT policy, OR the auto-generation must happen via an admin-level operation. Best approach: add an INSERT policy for students on their own row.

### Migration Required

```sql
CREATE POLICY "Students insert own id card"
  ON public.student_id_cards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students update own id card"
  ON public.student_id_cards FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Total: 1 migration, 2 file edits

