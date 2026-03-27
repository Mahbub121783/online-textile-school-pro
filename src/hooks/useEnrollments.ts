import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useEnrollments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['enrollments', user?.id],
    enabled: !!user,
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
    queryFn: async () => {
      const { data } = await supabase
        .from('enrollments')
        .select('id')
        .eq('user_id', user!.id)
        .eq('course_id', courseId!)
        .maybeSingle();
      return !!data;
    },
  });
}

export function useLessonProgress(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['lesson-progress', user?.id, courseId],
    enabled: !!user && !!courseId,
    queryFn: async () => {
      const { data: sections } = await supabase
        .from('course_sections')
        .select('id')
        .eq('course_id', courseId!);
      if (!sections?.length) return [];

      const sectionIds = sections.map((s) => s.id);
      const { data: lessons } = await supabase
        .from('lessons')
        .select('id')
        .in('section_id', sectionIds);
      if (!lessons?.length) return [];

      const lessonIds = lessons.map((l) => l.id);
      const { data, error } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', user!.id)
        .in('lesson_id', lessonIds);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMarkLessonComplete() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ lessonId, courseId }: { lessonId: string; courseId: string }) => {
      const { error } = await supabase
        .from('lesson_progress')
        .upsert({
          user_id: user!.id,
          lesson_id: lessonId,
          completed: true,
          completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,lesson_id' });
      if (error) throw error;
    },
    onSuccess: (_, { courseId }) => {
      qc.invalidateQueries({ queryKey: ['lesson-progress', user?.id, courseId] });
      qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
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
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
