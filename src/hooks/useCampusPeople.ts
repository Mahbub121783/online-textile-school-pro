import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CampusPerson {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  is_public_contributor: boolean;
  created_at: string;
}

/**
 * Anyone (student or instructor) who has linked themselves to a campus via
 * user_profiles.onboarded_campus_id, split by whether they hold the
 * 'instructor' role. Only public-safe columns are selected -- user_profiles
 * has no row-level SELECT restriction (RLS policy is USING (true)), so the
 * client-side column allowlist here is the only thing keeping private
 * fields (phone, DOB, address, etc.) out of this public-facing list.
 */
export function useCampusPeople(campusId?: string) {
  return useQuery({
    queryKey: ['campus-people', campusId],
    enabled: !!campusId,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url, headline, bio, is_public_contributor, created_at')
        .eq('onboarded_campus_id', campusId!);
      if (error) throw error;

      const ids = (profiles || []).map((p: any) => p.id);
      if (ids.length === 0) return { instructors: [] as CampusPerson[], students: [] as CampusPerson[] };

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instructor')
        .in('user_id', ids);
      if (rolesError) throw rolesError;

      const instructorIds = new Set((roles || []).map((r: any) => r.user_id));
      return {
        instructors: (profiles || []).filter((p: any) => instructorIds.has(p.id)) as CampusPerson[],
        students: (profiles || []).filter((p: any) => !instructorIds.has(p.id)) as CampusPerson[],
      };
    },
  });
}
