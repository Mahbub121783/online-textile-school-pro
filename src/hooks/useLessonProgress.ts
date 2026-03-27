import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface LessonProgressEntry {
  lesson_id: string;
  completed: boolean;
  completed_at: string | null;
}

export function useLessonProgress() {
  const { user } = useAuth();

  const { data: progressMap = new Map<string, LessonProgressEntry>(), isLoading } = useQuery({
    queryKey: ['lesson-progress-map', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('lesson_progress')
        .select('lesson_id, completed, completed_at')
        .eq('user_id', user!.id);
      const map = new Map<string, LessonProgressEntry>();
      (data ?? []).forEach((lp: any) => {
        map.set(lp.lesson_id, {
          lesson_id: lp.lesson_id,
          completed: lp.completed ?? false,
          completed_at: lp.completed_at,
        });
      });
      return map;
    },
    staleTime: 30_000,
  });

  const isLessonCompleted = (lessonId: string) => progressMap.get(lessonId)?.completed ?? false;

  const areSectionLessonsCompleted = (lessonIds: string[]) =>
    lessonIds.length > 0 && lessonIds.every((id) => isLessonCompleted(id));

  return { progressMap, isLoading, isLessonCompleted, areSectionLessonsCompleted };
}
