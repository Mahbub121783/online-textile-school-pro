import { supabase } from '@/integrations/supabase/client';

/**
 * Ensures a student ID card exists and is up-to-date for a user with paid enrollments.
 * Creates a new card if none exists, or extends validity if new paid courses were added.
 * Returns true if a card was created or updated.
 */
export async function ensureStudentIdCard(userId: string): Promise<boolean> {
  // 1. Get all paid enrollments
  const { data: paidEnrollments } = await supabase
    .from('enrollments')
    .select('id, enrolled_at, payment_id')
    .eq('user_id', userId)
    .not('payment_id', 'is', null)
    .order('enrolled_at', { ascending: true });

  if (!paidEnrollments?.length) return false;

  const count = paidEnrollments.length;
  const earliest = new Date(paidEnrollments[0].enrolled_at!);
  const validUntil = new Date(earliest);
  validUntil.setMonth(validUntil.getMonth() + count * 6);

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
