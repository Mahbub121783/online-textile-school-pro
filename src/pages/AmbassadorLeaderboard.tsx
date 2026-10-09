import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Star, Building2, Trophy } from 'lucide-react';
import { useMemo } from 'react';

const SUB_ROLE_META: Record<string, { label: string; icon: any }> = {
  head_of_campus: { label: 'Head of Campus Ambassador', icon: Crown },
  ambassador: { label: 'Ambassador', icon: Star },
};

const AmbassadorLeaderboard = () => {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['ambassador-leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_applications')
        .select('id, sub_role, points, user_id, profile:user_profiles(full_name, avatar_url, roll_id), campus:campus_onboard_requests(id, campus_name, logo_url)')
        .eq('status', 'approved')
        .in('sub_role', ['head_of_campus', 'ambassador'])
        .not('campus_id', 'is', null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const campusGroups = useMemo(() => {
    const groups = new Map<string, { campusName: string; logoUrl: string | null; members: any[] }>();
    for (const r of rows as any[]) {
      const cid = r.campus?.id;
      if (!cid) continue;
      if (!groups.has(cid)) groups.set(cid, { campusName: r.campus.campus_name, logoUrl: r.campus.logo_url, members: [] });
      groups.get(cid)!.members.push(r);
    }
    const arr = Array.from(groups.values());
    arr.forEach((g) => {
      g.members.sort((a, b) => {
        if (a.sub_role !== b.sub_role) return a.sub_role === 'head_of_campus' ? -1 : 1;
        return (b.points || 0) - (a.points || 0);
      });
    });
    arr.sort((a, b) => a.campusName.localeCompare(b.campusName));
    return arr;
  }, [rows]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="h-8 w-8 text-amber-500" />
          <h1 className="font-heading text-3xl font-bold">Campus Ambassadors</h1>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground py-12 text-center animate-pulse">Loading...</div>
        ) : campusGroups.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Trophy className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p>No campus ambassadors yet.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-10">
            {campusGroups.map((g) => (
              <div key={g.campusName}>
                <div className="flex items-center gap-2 mb-3">
                  {g.logoUrl ? (
                    <img src={g.logoUrl} alt="" className="w-7 h-7 rounded-lg object-cover" />
                  ) : (
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  )}
                  <h2 className="font-heading text-xl font-bold">{g.campusName}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {g.members.map((m: any) => {
                    const meta = SUB_ROLE_META[m.sub_role];
                    const Icon = meta?.icon || Star;
                    return (
                      <Card key={m.id} className={m.sub_role === 'head_of_campus' ? 'border-amber-400/60' : ''}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                            {m.profile?.avatar_url
                              ? <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                              : <span className="font-bold">{(m.profile?.full_name || '?')[0]}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{m.profile?.full_name || 'Ambassador'}</p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Icon className="h-3 w-3" /> {meta?.label}
                            </p>
                          </div>
                          <p className="font-bold font-heading text-primary shrink-0">{m.points} <span className="text-xs text-muted-foreground font-normal">pts</span></p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AmbassadorLeaderboard;
