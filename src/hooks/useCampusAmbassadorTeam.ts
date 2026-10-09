import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TeamCardData } from '@/lib/teamCardRenderer';

export function useCampusAmbassadorTeam(campusId: string | null | undefined, campusName: string | null | undefined) {
  return useQuery<TeamCardData | null>({
    queryKey: ['campus-ambassador-team', campusId],
    enabled: !!campusId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_applications')
        .select('sub_role, session_id, profile:user_profiles(full_name, avatar_url), session:ambassador_sessions(label)')
        .eq('campus_id', campusId!)
        .eq('status', 'approved');
      if (error) throw error;
      const rows = data ?? [];
      const toMember = (r: any) => ({ name: r.profile?.full_name || 'Ambassador', avatarUrl: r.profile?.avatar_url || null });
      const head = rows.find((r: any) => r.sub_role === 'head_of_campus');
      // Most common session label among the team, as the card's single "season" footer.
      const sessionCounts = new Map<string, number>();
      rows.forEach((r: any) => { if (r.session?.label) sessionCounts.set(r.session.label, (sessionCounts.get(r.session.label) || 0) + 1); });
      const sessionLabel = [...sessionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      return {
        campusName: campusName || 'Campus',
        sessionLabel,
        head: head ? toMember(head) : null,
        ambassadors: rows.filter((r: any) => r.sub_role === 'ambassador').map(toMember),
        graphics: rows.filter((r: any) => r.sub_role === 'graphics_team').map(toMember),
      };
    },
  });
}
