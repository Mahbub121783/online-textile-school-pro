import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Flame, Zap, Trophy, ArrowRight, Award } from 'lucide-react';

const PracticeWidget = () => {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['dash-practice-widget', user?.id],
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const [{ data: stats }, { data: lastBadge }, { data: lastSession }] = await Promise.all([
        supabase.from('qb_user_stats').select('*').eq('user_id', user!.id).maybeSingle(),
        supabase
          .from('qb_user_badges')
          .select('badge_key, earned_at, qb_badges(name, icon, tier)')
          .eq('user_id', user!.id)
          .order('earned_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('qb_exam_sessions')
          .select('id, percentage, passed, submitted_at, qb_subjects(name, icon)')
          .eq('user_id', user!.id)
          .not('submitted_at', 'is', null)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return { stats, lastBadge, lastSession };
    },
  });

  const stats = data?.stats;
  const lastBadge: any = data?.lastBadge;
  const lastSession: any = data?.lastSession;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden relative">
      <div className="absolute -top-10 -right-10 opacity-10">
        <Brain className="h-40 w-40 text-primary" />
      </div>
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-heading font-bold text-lg">Practice Arena</h3>
            </div>
            <p className="text-xs text-muted-foreground">Your textile brain stats</p>
          </div>
          <Button asChild size="sm" variant="ghost" className="h-7">
            <Link to="/dashboard/practice">
              Details <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>

        {!stats ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">No practice attempts yet.</p>
            <Button asChild size="sm">
              <Link to="/practice">Take your first exam</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <Zap className="h-4 w-4 mx-auto mb-0.5 text-amber-600" />
                <p className="font-bold font-heading text-lg text-amber-700 dark:text-amber-400 tabular-nums leading-none">
                  {stats.total_xp}
                </p>
                <p className="text-[9px] uppercase text-muted-foreground mt-0.5">XP</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30">
                <Flame className="h-4 w-4 mx-auto mb-0.5 text-rose-600" />
                <p className="font-bold font-heading text-lg text-rose-700 dark:text-rose-400 tabular-nums leading-none">
                  {stats.current_streak}
                </p>
                <p className="text-[9px] uppercase text-muted-foreground mt-0.5">Streak</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                <Trophy className="h-4 w-4 mx-auto mb-0.5 text-emerald-600" />
                <p className="font-bold font-heading text-lg text-emerald-700 dark:text-emerald-400 tabular-nums leading-none">
                  {stats.exams_passed}/{stats.exams_taken}
                </p>
                <p className="text-[9px] uppercase text-muted-foreground mt-0.5">Passed</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-primary/10">
                <Award className="h-4 w-4 mx-auto mb-0.5 text-primary" />
                <p className="font-bold font-heading text-lg text-primary tabular-nums leading-none">
                  {stats.perfect_scores}
                </p>
                <p className="text-[9px] uppercase text-muted-foreground mt-0.5">Perfect</p>
              </div>
            </div>

            {(lastBadge?.qb_badges || lastSession) && (
              <div className="space-y-1.5 mb-3">
                {lastBadge?.qb_badges && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-base">{lastBadge.qb_badges.icon || '🏅'}</span>
                    <span className="text-muted-foreground">Latest badge:</span>
                    <Badge variant="outline" className="text-[10px]">
                      {lastBadge.qb_badges.name}
                    </Badge>
                  </div>
                )}
                {lastSession && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-base">{lastSession.qb_subjects?.icon || '🧠'}</span>
                    <span className="text-muted-foreground truncate">
                      Last: {lastSession.qb_subjects?.name} —{' '}
                      <span className={lastSession.passed ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                        {Math.round(Number(lastSession.percentage))}%
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button asChild size="sm" className="flex-1">
                <Link to="/practice">Continue</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/practice/leaderboard">
                  <Trophy className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PracticeWidget;
