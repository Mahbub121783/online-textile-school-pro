import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TopLeaderboardRow {
  user_id: string;
  rank: number;
  total_points: number;
  total_exams: number;
  avg_percentage: number;
  profile?: { full_name: string | null; avatar_url: string | null; roll_id: string | null };
}

// Backs the "Today's Top 3" / "This Week's Top 3" hero-banner slides.
// qb_leaderboard_cache is refreshed instantly on every exam submission
// (trigger on qb_exam_sessions, db/69 + db/73) and every 15 min via cron
// as a safety net, so a short client poll on top of that is enough to make
// the banner feel live without hammering the server.
export const useTopLeaderboard = (period: 'daily' | 'weekly', limit = 3) => {
  return useQuery({
    queryKey: ['hero-leaderboard-top', period, limit],
    queryFn: async (): Promise<TopLeaderboardRow[]> => {
      const { data } = await supabase
        .from('qb_leaderboard_cache')
        .select('user_id, rank, total_points, total_exams, avg_percentage')
        .eq('period', period)
        .is('subject_id', null)
        .is('difficulty', null)
        .order('total_points', { ascending: false })
        .limit(limit);
      const rows = data ?? [];
      const userIds = rows.map((r: any) => r.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url, roll_id')
        .in('id', userIds);
      const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return rows.map((r: any) => ({ ...r, profile: pmap.get(r.user_id) }));
    },
    staleTime: 5000,
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
};
