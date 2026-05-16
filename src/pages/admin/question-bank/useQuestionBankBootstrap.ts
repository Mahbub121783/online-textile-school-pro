import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SubjectCount = { total: number; basic: number; intermediate: number; advanced: number };

export type QBBootstrap = {
  subjects: any[];
  countsBySubject: Record<string, SubjectCount>;
  kpi: { questions: number; exams7d: number; violations24h: number; live: number };
  aiSettings: any | null;
};

const EMPTY_COUNT: SubjectCount = { total: 0, basic: 0, intermediate: 0, advanced: 0 };

export function useQuestionBankBootstrap() {
  return useQuery<QBBootstrap>({
    queryKey: ['admin-qb-bootstrap'],
    staleTime: 30_000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: 1,
    queryFn: async () => {
      const since24h = new Date(Date.now() - 86_400_000).toISOString();
      const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();

      const [subjectsRes, countsRes, qsRes, exams7dRes, viol24hRes, liveRes, settingsRes] = await Promise.all([
        supabase.from('qb_subjects').select('*').order('sort_order'),
        supabase.rpc('qb_subject_question_counts'),
        supabase.from('qb_questions').select('id', { count: 'exact', head: true }),
        supabase.from('qb_exam_sessions').select('id', { count: 'exact', head: true }).gte('started_at', since7d),
        supabase.from('qb_exam_violations').select('id', { count: 'exact', head: true }).gte('occurred_at', since24h),
        supabase.from('qb_exam_sessions').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('qb_ai_settings').select('*').limit(1).maybeSingle(),
      ]);

      const countsBySubject: Record<string, SubjectCount> = {};
      ((countsRes.data as any[]) ?? []).forEach((r) => {
        countsBySubject[r.subject_id] = {
          total: Number(r.total) || 0,
          basic: Number(r.basic) || 0,
          intermediate: Number(r.intermediate) || 0,
          advanced: Number(r.advanced) || 0,
        };
      });

      return {
        subjects: subjectsRes.data ?? [],
        countsBySubject,
        kpi: {
          questions: qsRes.count ?? 0,
          exams7d: exams7dRes.count ?? 0,
          violations24h: viol24hRes.count ?? 0,
          live: liveRes.count ?? 0,
        },
        aiSettings: settingsRes.data ?? null,
      };
    },
  });
}

export { EMPTY_COUNT };
