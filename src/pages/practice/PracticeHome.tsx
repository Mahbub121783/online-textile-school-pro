import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Trophy, History, ArrowRight, Sparkles } from 'lucide-react';
import SEOHead from '@/components/SEOHead';

const PracticeHome = () => {
  const { user } = useAuth();

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['qb-subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qb_subjects')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ['qb-question-counts', subjects.map((s) => s.id)],
    enabled: subjects.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('qb_questions')
        .select('subject_id, difficulty')
        .eq('is_active', true);
      const map: Record<string, { basic: number; intermediate: number; advanced: number; total: number }> = {};
      (data ?? []).forEach((q: any) => {
        if (!map[q.subject_id]) map[q.subject_id] = { basic: 0, intermediate: 0, advanced: 0, total: 0 };
        map[q.subject_id][q.difficulty as 'basic' | 'intermediate' | 'advanced']++;
        map[q.subject_id].total++;
      });
      return map;
    },
  });

  const { data: myStats } = useQuery({
    queryKey: ['qb-my-stats', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('qb_exam_sessions')
        .select('subject_id, percentage, passed')
        .eq('user_id', user!.id)
        .not('submitted_at', 'is', null);
      const bySubject: Record<string, { best: number; attempts: number }> = {};
      let totalAttempts = 0;
      let totalPassed = 0;
      let avg = 0;
      (data ?? []).forEach((s: any) => {
        totalAttempts++;
        if (s.passed) totalPassed++;
        avg += Number(s.percentage);
        if (!bySubject[s.subject_id]) bySubject[s.subject_id] = { best: 0, attempts: 0 };
        bySubject[s.subject_id].attempts++;
        if (s.percentage > bySubject[s.subject_id].best) bySubject[s.subject_id].best = Number(s.percentage);
      });
      return { bySubject, totalAttempts, totalPassed, avg: totalAttempts ? Math.round(avg / totalAttempts) : 0 };
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Practice Exam — Brain Test | Question Bank" description="Test your knowledge with practice exams across multiple subjects and difficulty levels." />
      <div className="container mx-auto px-4 py-10 max-w-6xl">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/90 via-primary to-accent text-primary-foreground p-8 md:p-12 mb-10">
          <div className="absolute -right-10 -top-10 opacity-10">
            <Brain className="h-64 w-64" />
          </div>
          <div className="relative">
            <Badge className="bg-white/20 hover:bg-white/30 border-0 mb-4">
              <Sparkles className="h-3 w-3 mr-1" /> Brain Test
            </Badge>
            <h1 className="font-heading text-3xl md:text-5xl font-bold mb-3">Practice Exam Hub</h1>
            <p className="text-base md:text-lg opacity-90 max-w-2xl">
              Choose a subject, pick a difficulty, and tackle 25 challenging questions. Track your progress, climb the leaderboard.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              {user && (
                <Button asChild variant="secondary" size="lg">
                  <Link to="/practice/history"><History className="h-4 w-4 mr-2" /> My History</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg" className="bg-white/10 border-white/30 hover:bg-white/20 text-primary-foreground">
                <Link to="/practice/leaderboard"><Trophy className="h-4 w-4 mr-2" /> Leaderboard</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* My stats */}
        {user && myStats && myStats.totalAttempts > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold font-heading text-primary">{myStats.totalAttempts}</p><p className="text-xs text-muted-foreground">Exams Taken</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold font-heading text-emerald-600">{myStats.totalPassed}</p><p className="text-xs text-muted-foreground">Passed</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold font-heading text-accent">{myStats.avg}%</p><p className="text-xs text-muted-foreground">Avg Score</p></CardContent></Card>
          </div>
        )}

        <h2 className="font-heading text-2xl font-bold mb-4">Subjects</h2>

        {isLoading ? (
          <div className="text-muted-foreground py-12 text-center animate-pulse">Loading subjects...</div>
        ) : subjects.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Brain className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="font-heading font-bold text-lg">No subjects available yet</p>
            <p className="text-sm mt-1">Admin will add subjects and questions soon.</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((s: any) => {
              const c = counts[s.id] || { basic: 0, intermediate: 0, advanced: 0, total: 0 };
              const stat = myStats?.bySubject[s.id];
              return (
                <Link key={s.id} to={`/practice/${s.slug}`} className="group">
                  <Card className="h-full hover:shadow-lg hover:-translate-y-0.5 transition-all border-2 hover:border-primary/40">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                          style={{ background: s.color ? `${s.color}20` : 'hsl(var(--primary)/0.1)', color: s.color || 'hsl(var(--primary))' }}
                        >
                          {s.icon || '🧠'}
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <h3 className="font-heading font-bold text-lg leading-tight">{s.name}</h3>
                      {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">{c.total} Q</Badge>
                        <Badge variant="outline" className="text-[10px]">B {c.basic}</Badge>
                        <Badge variant="outline" className="text-[10px]">I {c.intermediate}</Badge>
                        <Badge variant="outline" className="text-[10px]">A {c.advanced}</Badge>
                      </div>
                      {stat && (
                        <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Your best</span>
                          <span className="font-bold text-primary">{Math.round(stat.best)}%</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticeHome;
