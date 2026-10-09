import { supabase } from '@/integrations/supabase/client';

/**
 * Ensures a student ID card exists and is up-to-date for a user with at
 * least one genuinely paid enrollment, OR an approved campus ambassador
 * (program perk, flat 1-year validity instead of the enrollment-tiered
 * formula). Creates a new card if none exists, or extends validity if new
 * courses were added. Returns true if a card was created or updated.
 */
export async function ensureStudentIdCard(userId: string): Promise<boolean> {
  // Existing card already covers the user (paid-enrollment path below, or
  // a previous ambassador-perk issuance) -- nothing to do either way.
  const { data: existingCard } = await supabase
    .from('student_id_cards')
    .select('id, valid_until')
    .eq('user_id', userId)
    .maybeSingle();

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

  const { data: allEnrollments } = paidOrderIds.length
    ? await supabase
        .from('enrollments')
        .select('id, enrolled_at, payment_id')
        .eq('user_id', userId)
        .order('enrolled_at', { ascending: true })
    : { data: null };

  if (!allEnrollments?.length) {
    // No paid enrollment -- still issue a card if this user is an approved
    // campus ambassador (a program perk, not something they bought). Flat
    // 1-year validity instead of the enrollment-based tiered formula below,
    // since there's no enrollment history to compute from -- matches
    // enforce_student_id_card_integrity()'s ambassador branch (db/91).
    if (existingCard) return false;
    const { data: amb } = await supabase
      .from('ambassador_applications')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .maybeSingle();
    if (!amb) return false;

    const cardNumber = `OTS-ID-${Math.floor(100000 + Math.random() * 900000)}`;
    const { error } = await supabase.from('student_id_cards').insert({
      user_id: userId,
      card_number: cardNumber,
    });
    if (error) { console.error('Failed to create ambassador ID card:', error); return false; }
    return true;
  }

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

  if (existingCard) {
    // Only update if new validity is greater
    if (new Date(existingCard.valid_until) < validUntil) {
      await supabase
        .from('student_id_cards')
        .update({
          valid_until: validUntil.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCard.id);
      return true;
    }
    return false;
  }

  // 2. Generate card number
  const cardNumber = `OTS-ID-${Math.floor(100000 + Math.random() * 900000)}`;

  // 3. Insert new card
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
