import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Flame, Zap, Trophy, Award, History as HistoryIcon, Eye, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import SEOHead from '@/components/SEOHead';

const DIFF_COLOR: Record<string, string> = {
  basic: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  intermediate: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  advanced: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
};

const PracticePage = () => {
  const { user, profile } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['dash-practice-stats', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('qb_user_stats').select('*').eq('user_id', user!.id).maybeSingle();
      return data;
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['dash-practice-sessions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('qb_exam_sessions')
        .select('*, qb_subjects(name, icon, color)')
        .eq('user_id', user!.id)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: badges = [] } = useQuery({
    queryKey: ['dash-practice-badges', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('qb_user_badges')
        .select('badge_key, earned_at, qb_badges(name, icon, tier, description)')
        .eq('user_id', user!.id)
        .order('earned_at', { ascending: false });
      return data ?? [];
    },
  });

  // Aggregate per department + per difficulty
  const byDept: Record<string, { name: string; icon: string; attempts: number; passed: number; best: number; avg: number }> = {};
  const byDiff: Record<string, { attempts: number; passed: number; avg: number }> = {};
  sessions.forEach((s: any) => {
    const key = s.subject_id || 'mixed';
    const name = s.qb_subjects?.name || 'Mixed';
    const icon = s.qb_subjects?.icon || '🎲';
    if (!byDept[key]) byDept[key] = { name, icon, attempts: 0, passed: 0, best: 0, avg: 0 };
    byDept[key].attempts++;
    if (s.passed) byDept[key].passed++;
    byDept[key].best = Math.max(byDept[key].best, Number(s.percentage || 0));
    byDept[key].avg += Number(s.percentage || 0);

    const d = s.difficulty;
    if (!byDiff[d]) byDiff[d] = { attempts: 0, passed: 0, avg: 0 };
    byDiff[d].attempts++;
    if (s.passed) byDiff[d].passed++;
    byDiff[d].avg += Number(s.percentage || 0);
  });
  Object.values(byDept).forEach((d) => { d.avg = d.attempts ? d.avg / d.attempts : 0; });
  Object.values(byDiff).forEach((d) => { d.avg = d.attempts ? d.avg / d.attempts : 0; });

  return (
    <div className="space-y-6">
      <SEOHead title="My Practice Arena | Dashboard" description="Your textile practice performance" />

      {/* Header — identity unification */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden">
        <CardContent className="p-5 flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Brain className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="font-heading text-2xl font-bold">My Practice Arena</h1>
            <p className="text-xs text-muted-foreground">
              {profile?.full_name} · <span className="font-mono">{profile?.roll_id}</span>
            </p>
          </div>
          <Button asChild>
            <Link to="/practice">Practice Hub <ArrowRight className="h-4 w-4 ml-1" /></Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/practice/leaderboard"><Trophy className="h-4 w-4 mr-1" /> Leaderboard</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-2 border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="p-4 text-center">
            <Zap className="h-5 w-5 mx-auto mb-1 text-amber-600" />
            <p className="text-2xl font-bold font-heading text-amber-700 dark:text-amber-400 tabular-nums">{stats?.total_xp ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Total XP</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20">
          <CardContent className="p-4 text-center">
            <Flame className="h-5 w-5 mx-auto mb-1 text-rose-600" />
            <p className="text-2xl font-bold font-heading text-rose-700 dark:text-rose-400 tabular-nums">{stats?.current_streak ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Current Streak</p>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="p-4 text-center">
            <Flame className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <p className="text-2xl font-bold font-heading tabular-nums">{stats?.longest_streak ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Longest</p>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="p-4 text-center">
            <Trophy className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
            <p className="text-2xl font-bold font-heading text-emerald-600 tabular-nums">{stats?.exams_passed ?? 0}/{stats?.exams_taken ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Passed</p>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="p-4 text-center">
            <Award className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold font-heading text-primary tabular-nums">{stats?.perfect_scores ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Perfect</p>
          </CardContent>
        </Card>
      </div>

      {/* Per department + per difficulty */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h3 className="font-heading font-bold mb-3">By Department</h3>
            {Object.keys(byDept).length === 0 ? (
              <p className="text-sm text-muted-foreground">No attempts yet.</p>
            ) : (
              <div className="space-y-2">
                {Object.values(byDept).map((d, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                    <span className="text-2xl">{d.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.attempts} attempts · {d.passed} passed · avg {Math.round(d.avg)}%
                      </p>
                    </div>
                    <Badge variant="outline" className="font-bold">{Math.round(d.best)}%</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="font-heading font-bold mb-3">By Difficulty</h3>
            {Object.keys(byDiff).length === 0 ? (
              <p className="text-sm text-muted-foreground">No attempts yet.</p>
            ) : (
              <div className="space-y-2">
                {(['basic', 'intermediate', 'advanced'] as const).map((d) => {
                  const row = byDiff[d];
                  if (!row) return null;
                  return (
                    <div key={d} className={`flex items-center gap-3 p-2 rounded-lg border ${DIFF_COLOR[d]}`}>
                      <span className="font-bold capitalize text-sm w-24">{d}</span>
                      <span className="text-xs flex-1">{row.attempts} attempts · {row.passed} passed</span>
                      <Badge variant="outline" className="bg-background font-bold">avg {Math.round(row.avg)}%</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Badges */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-heading font-bold mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" /> Badges ({badges.length})
          </h3>
          {badges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No badges yet — pass exams to earn them.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {badges.map((b: any, i: number) => (
                <div key={i} className="text-center p-3 rounded-xl border-2 bg-muted/20 hover:bg-muted/40 transition">
                  <div className="text-3xl mb-1">{b.qb_badges?.icon || '🏅'}</div>
                  <p className="text-[11px] font-bold leading-tight">{b.qb_badges?.name}</p>
                  {b.qb_badges?.tier && (
                    <Badge variant="outline" className="text-[9px] mt-1 capitalize">{b.qb_badges.tier}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent exams */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-bold flex items-center gap-2">
              <HistoryIcon className="h-4 w-4" /> Recent Exams
            </h3>
            <Button asChild size="sm" variant="ghost">
              <Link to="/practice/history">View all <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exam attempts yet.</p>
          ) : (
            <div className="space-y-1.5">
              {sessions.slice(0, 10).map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition">
                  <span className="text-xl">{s.qb_subjects?.icon || '🧠'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{s.qb_subjects?.name || 'Mixed'}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge variant="outline" className="text-[9px] capitalize">{s.difficulty}</Badge>
                      <span>{format(new Date(s.submitted_at), 'MMM d, h:mm a')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {s.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-rose-500" />}
                    <span className={`font-bold text-sm ${s.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {Math.round(Number(s.percentage))}%
                    </span>
                  </div>
                  <Button asChild size="sm" variant="ghost" className="h-7">
                    <Link to={`/practice/result/${s.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PracticePage;
