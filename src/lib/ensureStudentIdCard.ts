import { supabase } from '@/integrations/supabase/client';

/**
 * Ensures a student ID card exists and is up-to-date for a user with at
 * least one genuinely paid enrollment. Creates a new card if none exists,
 * or extends validity if new courses were added. Returns true if a card
 * was created or updated.
 */
export async function ensureStudentIdCard(userId: string): Promise<boolean> {
  // 1. Get all paid enrollments. `payment_id` alone is not proof of payment --
  // it's set to the order id for every checkout, including $0 free-course
  // self-enrollment. Only an order that actually completed for a nonzero
  // total counts as "paid" (matches enforce_student_id_card_integrity()
  // in db/66-id-card-require-real-payment.sql, the server-side gate).
  const { data: paidOrders } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gt('total', 0);
  const paidOrderIds = (paidOrders || []).map((o) => o.id);
  if (paidOrderIds.length === 0) return false;

  const { data: allEnrollments } = await supabase
    .from('enrollments')
    .select('id, enrolled_at, payment_id')
    .eq('user_id', userId)
    .order('enrolled_at', { ascending: true });

  if (!allEnrollments?.length) return false;

  const paidOrderIdSet = new Set(paidOrderIds);
  const paidCount = allEnrollments.filter((e) => e.payment_id && paidOrderIdSet.has(e.payment_id)).length;
  if (paidCount === 0) return false;
  const freeCount = allEnrollments.length - paidCount;

  // Duration: 1.2 years for the first paid course, +6 months per additional
  // paid course, +6 months once (not per-course) if there's also a free
  // course on record. Mirrors enforce_student_id_card_integrity() in
  // db/67-id-card-tiered-duration.sql, the authoritative server-side
  // computation -- this is only an estimate used to decide whether an
  // insert/update is worth attempting.
  const earliest = new Date(allEnrollments[0].enrolled_at!);
  let totalMonths = 14.4 + Math.max(paidCount - 1, 0) * 6;
  if (freeCount > 0) totalMonths += 6;
  const validUntil = new Date(earliest.getTime() + totalMonths * 30.44 * 24 * 60 * 60 * 1000);

  // 2. Check existing card
  const { data: existing } = await supabase
    .from('student_id_cards')
    .select('id, valid_until')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    // Only update if new validity is greater
    if (new Date(existing.valid_until) < validUntil) {
      await supabase
        .from('student_id_cards')
        .update({
          valid_until: validUntil.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      return true;
    }
    return false;
  }

  // 3. Generate card number
  const cardNumber = `OTS-ID-${Math.floor(100000 + Math.random() * 900000)}`;

  // 4. Insert new card
  const { error } = await supabase.from('student_id_cards').insert({
    user_id: userId,
    card_number: cardNumber,
    valid_from: earliest.toISOString(),
    valid_until: validUntil.toISOString(),
  });

  if (error) {
    console.error('Failed to create student ID card:', error);
    return false;
  }

  return true;
}
