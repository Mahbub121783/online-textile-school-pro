import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Trophy, Crown, Medal } from 'lucide-react';

type Diff = 'all' | 'basic' | 'intermediate' | 'advanced';

const PracticeLeaderboard = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'all_time' | 'monthly' | 'weekly'>('all_time');
  const [subjectId, setSubjectId] = useState<string>('all');
  const [difficulty, setDifficulty] = useState<Diff>('all');

  const { data: subjects = [] } = useQuery({
    queryKey: ['qb-subjects-lb'],
    queryFn: async () => {
      const { data } = await supabase.from('qb_subjects').select('id, name').eq('is_active', true).order('sort_order');
      return data ?? [];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['qb-leaderboard', period, subjectId, difficulty],
    queryFn: async () => {
      let q = supabase.from('qb_leaderboard_cache').select('*').eq('period', period).order('total_points', { ascending: false }).limit(100);
      q = subjectId === 'all' ? q.is('subject_id', null) : q.eq('subject_id', subjectId);
      q = difficulty === 'all' ? q.is('difficulty', null) : q.eq('difficulty', difficulty);
      // Per-difficulty buckets only exist for all_time — fall back gracefully
      if (period !== 'all_time' && difficulty !== 'all') {
        q = supabase.from('qb_leaderboard_cache').select('*').eq('period', period).order('total_points', { ascending: false }).limit(100);
        q = subjectId === 'all' ? q.is('subject_id', null) : q.eq('subject_id', subjectId);
        q = q.is('difficulty', null);
      }
      const { data } = await q;
      const userIds = (data ?? []).map((r: any) => r.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, avatar_url, roll_id').in('id', userIds);
      const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((r: any) => ({ ...r, profile: pmap.get(r.user_id) }));
    },
  });

  const myRow = rows.find((r: any) => r.user_id === user?.id);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/practice"><ArrowLeft className="h-4 w-4 mr-1" /> Practice Hub</Link>
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <Trophy className="h-8 w-8 text-amber-500" />
          <h1 className="font-heading text-3xl font-bold">Leaderboard</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
            <TabsList>
              <TabsTrigger value="all_time">All Time</TabsTrigger>
              <TabsTrigger value="monthly">This Month</TabsTrigger>
              <TabsTrigger value="weekly">This Week</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Diff)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulty</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {period !== 'all_time' && difficulty !== 'all' && (
          <p className="text-xs text-muted-foreground mb-3">
            Difficulty filter currently shows only in <strong>All Time</strong>. Showing combined ranking instead.
          </p>
        )}

        {myRow && (
          <Card className="mb-4 border-primary/40 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Badge className="bg-primary text-primary-foreground">#{myRow.rank}</Badge>
              <div className="flex-1">
                <p className="font-bold text-sm">You</p>
                <p className="text-xs text-muted-foreground">{myRow.total_exams} exams • {Math.round(Number(myRow.avg_percentage))}% avg</p>
              </div>
              <p className="font-bold font-heading text-primary">{myRow.total_points} pts</p>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-muted-foreground py-12 text-center animate-pulse">Loading...</div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Trophy className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p>No rankings for this filter yet.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r: any, i: number) => {
              const isMe = r.user_id === user?.id;
              return (
                <Card key={r.id} className={isMe ? 'border-primary' : ''}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-10 text-center font-heading font-bold text-lg">
                      {i === 0 ? <Crown className="h-6 w-6 mx-auto text-amber-500" /> :
                       i === 1 ? <Medal className="h-6 w-6 mx-auto text-slate-400" /> :
                       i === 2 ? <Medal className="h-6 w-6 mx-auto text-orange-600" /> :
                       <span className="text-muted-foreground">#{r.rank}</span>}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-muted overflow-hidden shrink-0">
                      {r.profile?.avatar_url
                        ? <img src={r.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center font-bold text-sm">{(r.profile?.full_name || '?')[0]}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.profile?.full_name || 'Unknown'} {isMe && <Badge variant="outline" className="ml-1 text-[10px]">You</Badge>}</p>
                      <p className="text-xs text-muted-foreground">{r.total_exams} exams • {Math.round(Number(r.avg_percentage))}% avg</p>
                    </div>
                    <p className="font-bold font-heading">{r.total_points} <span className="text-xs text-muted-foreground font-normal">pts</span></p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticeLeaderboard;
