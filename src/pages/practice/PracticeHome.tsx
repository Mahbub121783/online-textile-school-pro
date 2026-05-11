import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Trophy, History, ArrowRight, Sparkles, Zap, Flame, Award, Users } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';

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

  const { data: userStats } = useQuery({
    queryKey: ['qb-user-stats-home', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('qb_user_stats').select('*').eq('user_id', user!.id).maybeSingle();
      return data;
    },
  });

  const { data: globalStats } = useQuery({
    queryKey: ['qb-global-stats'],
    queryFn: async () => {
      const [{ count: qCount }, { count: examCount }, { count: studentCount }] = await Promise.all([
        supabase.from('qb_questions').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('qb_exam_sessions').select('*', { count: 'exact', head: true }).not('submitted_at', 'is', null),
        supabase.from('qb_user_stats').select('*', { count: 'exact', head: true }),
      ]);
      return { questions: qCount ?? 0, exams: examCount ?? 0, students: studentCount ?? 0 };
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <SEOHead title="Practice Arena — Test Your Edge | Online Textile School" description="Olympiad-style practice exams. Earn XP, unlock badges, climb the leaderboard. Test your knowledge across textile subjects." />
      <main className="flex-1 pb-16 lg:pb-0">
        <div className="container mx-auto px-4 py-6 md:py-10 max-w-6xl">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary-dark to-accent text-primary-foreground p-6 md:p-12 mb-8"
          >
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-accent/30 rounded-full blur-3xl" />
            <div className="absolute top-6 right-6 opacity-15 hidden md:block">
              <Brain className="h-48 w-48" />
            </div>
            <div className="relative">
              <Badge className="bg-white/20 hover:bg-white/30 border-0 mb-4">
                <Sparkles className="h-3 w-3 mr-1" /> Practice Arena
              </Badge>
              <h1 className="font-heading text-3xl md:text-5xl lg:text-6xl font-black mb-3 leading-tight">
                Test Your Edge.<br />Climb the Ranks.
              </h1>
              <p className="text-base md:text-lg opacity-90 max-w-2xl mb-6">
                Olympiad-style practice exams across every subject. Earn XP, unlock badges, build daily streaks.
              </p>

              {/* Live stats strip */}
              {globalStats && (
                <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6 max-w-2xl">
                  <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                    <p className="font-heading text-2xl md:text-3xl font-bold">{globalStats.questions.toLocaleString()}</p>
                    <p className="text-[10px] md:text-xs opacity-80 uppercase tracking-wide">Questions</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                    <p className="font-heading text-2xl md:text-3xl font-bold">{globalStats.exams.toLocaleString()}</p>
                    <p className="text-[10px] md:text-xs opacity-80 uppercase tracking-wide">Exams Taken</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                    <p className="font-heading text-2xl md:text-3xl font-bold">{globalStats.students.toLocaleString()}</p>
                    <p className="text-[10px] md:text-xs opacity-80 uppercase tracking-wide">Students</p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 md:gap-3">
                {user && (
                  <Button asChild variant="secondary" size="lg" className="font-bold">
                    <Link to="/practice/history"><History className="h-4 w-4 mr-2" /> My History</Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="lg" className="bg-white/10 border-white/40 hover:bg-white/20 text-primary-foreground font-bold">
                  <Link to="/practice/leaderboard"><Trophy className="h-4 w-4 mr-2" /> Leaderboard</Link>
                </Button>
              </div>
            </div>
          </motion.div>

          {/* My Stats Banner */}
          {user && userStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <Card className="border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                <CardContent className="p-4 text-center">
                  <Zap className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                  <p className="text-2xl font-bold font-heading text-amber-700 dark:text-amber-400 tabular-nums">{userStats.total_xp}</p>
                  <p className="text-[11px] text-muted-foreground uppercase">Total XP</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-rose-300 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30">
                <CardContent className="p-4 text-center">
                  <Flame className="h-5 w-5 mx-auto mb-1 text-rose-600" />
                  <p className="text-2xl font-bold font-heading text-rose-700 dark:text-rose-400 tabular-nums">{userStats.current_streak}</p>
                  <p className="text-[11px] text-muted-foreground uppercase">Day Streak</p>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <Trophy className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                  <p className="text-2xl font-bold font-heading text-emerald-600 tabular-nums">{userStats.exams_passed}/{userStats.exams_taken}</p>
                  <p className="text-[11px] text-muted-foreground uppercase">Passed</p>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <Award className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="text-2xl font-bold font-heading text-primary tabular-nums">{userStats.perfect_scores}</p>
                  <p className="text-[11px] text-muted-foreground uppercase">Perfect</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-heading text-2xl md:text-3xl font-bold">Choose Your Subject</h2>
            <span className="text-xs text-muted-foreground hidden md:inline">Pick difficulty after</span>
          </div>

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
                    <Card className="h-full hover:shadow-xl hover:-translate-y-1 transition-all border-2 hover:border-primary/40 overflow-hidden">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                            style={{ background: s.color ? `${s.color}20` : 'hsl(var(--primary)/0.1)', color: s.color || 'hsl(var(--primary))' }}
                          >
                            {s.icon || '🧠'}
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
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
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default PracticeHome;
