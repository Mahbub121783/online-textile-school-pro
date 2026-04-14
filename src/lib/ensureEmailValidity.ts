import { supabase } from '@/integrations/supabase/client';

/**
 * Ensures institutional email validity is up-to-date based on paid enrollments.
 * Extends valid_until by 6 months per paid enrollment (mirrors ensureStudentIdCard logic).
 * Returns true if validity was updated.
 */
export async function ensureEmailValidity(userId: string): Promise<boolean> {
  // 1. Get approved email request
  const { data: emailReq } = await supabase
    .from('institutional_email_requests')
    .select('id, status, valid_from, valid_until')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .maybeSingle();

  if (!emailReq) return false;

  // 2. Get all paid enrollments
  const { data: paidEnrollments } = await supabase
    .from('enrollments')
    .select('id, enrolled_at, payment_id')
    .eq('user_id', userId)
    .not('payment_id', 'is', null)
    .order('enrolled_at', { ascending: true });

  if (!paidEnrollments?.length) return false;

  const count = paidEnrollments.length;
  const baseDate = emailReq.valid_from ? new Date(emailReq.valid_from) : new Date(paidEnrollments[0].enrolled_at!);
  const newValidUntil = new Date(baseDate);
  newValidUntil.setMonth(newValidUntil.getMonth() + count * 6);

  const currentValidUntil = emailReq.valid_until ? new Date(emailReq.valid_until) : null;

  // Only update if new validity is greater
  if (!currentValidUntil || currentValidUntil < newValidUntil) {
    await supabase
      .from('institutional_email_requests')
      .update({
        valid_until: newValidUntil.toISOString(),
      })
      .eq('id', emailReq.id);
    return true;
  }

  // Check if expired — mark as expired and block via edge function
  if (currentValidUntil && currentValidUntil < new Date()) {
    // Just update status client-side; actual cPanel suspension handled by admin
    await supabase
      .from('institutional_email_requests')
      .update({ status: 'expired' as any })
      .eq('id', emailReq.id);
    return true;
  }

  return false;
}
