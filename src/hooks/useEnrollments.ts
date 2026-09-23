import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useEnrollments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['enrollments', user?.id],
    enabled: !!user,
    staleTime: 120000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrollments')
        .select('*, courses(id, title, slug, thumbnail_url, total_lessons, total_duration_minutes, instructor_id, user_profiles!courses_instructor_id_fkey(full_name))')
        .eq('user_id', user!.id)
        .order('enrolled_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useIsEnrolled(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['enrollment', user?.id, courseId],
    enabled: !!user && !!courseId,
    retry: 0,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('enrollments')
          .select('id')
          .eq('user_id', user!.id)
          .eq('course_id', courseId!)
          .maybeSingle();
        if (error) return false;
        return !!data;
      } catch {
        return false;
      }
    },
  });
}

export function useLessonProgress(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['lesson-progress', user?.id, courseId],
    enabled: !!user && !!courseId,
    retry: 0,
    queryFn: async () => {
      try {
        // One nested-embed round trip instead of 3 sequential ones
        // (course_sections -> lessons -> lesson_progress). No explicit
        // user_id filter needed on the embedded lesson_progress -- it's
        // RLS-scoped to `user_id = auth.uid()` (db/05-bootstrap-policies.sql),
        // so the DB only ever returns this user's own rows either way.
        const { data: sections } = await supabase
          .from('course_sections')
          .select('lessons(lesson_progress(*))')
          .eq('course_id', courseId!);
        if (!sections?.length) return [];
        return (sections as any[]).flatMap((s) => (s.lessons ?? []).flatMap((l: any) => l.lesson_progress ?? []));
      } catch {
        return [];
      }
    },
  });
}

export function useMarkLessonComplete() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ lessonId, courseId }: { lessonId: string; courseId: string }) => {
      // 1. Mark lesson complete
      const { error } = await supabase
        .from('lesson_progress')
        .upsert({
          user_id: user!.id,
          lesson_id: lessonId,
          completed: true,
          completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,lesson_id' });
      if (error) throw error;

      // 2. Recalculate enrollment progress_pct -- one nested-embed round
      // trip instead of 3 sequential ones, same technique as useLessonProgress above.
      const { data: sections } = await supabase
        .from('course_sections')
        .select('lessons(id, lesson_progress(completed))')
        .eq('course_id', courseId);
      if (!sections?.length) return;

      const allLessons = (sections as any[]).flatMap((s) => s.lessons ?? []);
      if (!allLessons.length) return;

      const completedCount = allLessons.filter((l: any) => l.lesson_progress?.[0]?.completed).length;
      const totalCount = allLessons.length;
      const progressPct = Math.round((completedCount / totalCount) * 100);

      // Update enrollment
      await supabase
        .from('enrollments')
        .update({
          progress_pct: progressPct,
          ...(progressPct >= 100 ? { completed_at: new Date().toISOString() } : {}),
        } as any)
        .eq('user_id', user!.id)
        .eq('course_id', courseId);

      // 3. Auto-issue certificate if course completed (100%)
      if (progressPct >= 100) {
        await autoIssueCertificate(user!.id, courseId);
      }
    },
    onSuccess: (_, { courseId }) => {
      qc.invalidateQueries({ queryKey: ['lesson-progress', user?.id, courseId] });
      qc.invalidateQueries({ queryKey: ['lesson-progress-map', user?.id] });
      qc.invalidateQueries({ queryKey: ['enrollments'] });
      qc.invalidateQueries({ queryKey: ['my-enrollments-cert', user?.id] });
      qc.invalidateQueries({ queryKey: ['my-certificates', user?.id] });
    },
  });
}

async function autoIssueCertificate(userId: string, courseId: string) {
  try {
    // Issuance is authoritative server-side now (backend/src/functions/issueCertificate.js)
    // -- this used to insert into `certificates` directly under the student's
    // own session, which the table's RLS policy (service_role/admin/
    // instructor/super_admin only) always correctly rejected, silently
    // breaking auto-issuance for every student. The endpoint re-verifies
    // completion/score eligibility itself before issuing, and sends the
    // in-app notification itself on success.
    const { data, error } = await supabase.functions.invoke('issue-certificate', {
      body: { course_id: courseId },
    });
    if (error || data?.error) {
      console.error('Auto-issue certificate failed:', error || data?.error);
    }
  } catch (err) {
    console.error('Certificate auto-issue error:', err);
  }
}

export function useWallet() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['wallet', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useWalletTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['wallet-transactions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (!wallet) return [];

      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('id, wallet_id, amount, type, description, reference_id, created_at')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}
