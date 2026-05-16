import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Trophy, History, ArrowRight, Sparkles, Zap, Flame, Award, Shuffle, Loader2 } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { toast } from '@/hooks/use-toast';

type Diff = 'basic' | 'intermediate' | 'advanced';

const PracticeHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mixedDiff, setMixedDiff] = useState<Diff>('basic');
  const [starting, setStarting] = useState(false);

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['qb-subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qb_subjects')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: myStats } = useQuery({
    queryKey: ['qb-my-stats', user?.id],
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('qb_exam_sessions')
        .select('subject_id, percentage, passed')
        .eq('user_id', user!.id)
        .not('submitted_at', 'is', null)
        .limit(200);
      const bySubject: Record<string, { best: number; attempts: number }> = {};
      (data ?? []).forEach((s: any) => {
        if (!s.subject_id) return;
        if (!bySubject[s.subject_id]) bySubject[s.subject_id] = { best: 0, attempts: 0 };
        bySubject[s.subject_id].attempts++;
        if (s.percentage > bySubject[s.subject_id].best) bySubject[s.subject_id].best = Number(s.percentage);
      });
      return { bySubject };
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
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const [{ count: qCount }, { count: examCount }, { count: studentCount }] = await Promise.all([
        supabase.from('qb_questions').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('qb_exam_sessions').select('*', { count: 'exact', head: true }).not('submitted_at', 'is', null),
        supabase.from('qb_user_stats').select('*', { count: 'exact', head: true }),
      ]);
      return { questions: qCount ?? 0, exams: examCount ?? 0, students: studentCount ?? 0 };
    },
  });

  const startMixed = async () => {
    if (!user) { toast({ title: 'Please sign in to start', variant: 'destructive' }); navigate('/auth/login'); return; }
    setStarting(true);
    try {
      const { data, error } = await supabase.rpc('qb_start_mixed_exam', { _difficulty: mixedDiff, _question_count: 30 });
      if (error) throw error;
      navigate(`/practice/exam/${(data as any).session_id}`);
    } catch (e: any) {
      toast({ title: 'Could not start exam', description: e.message, variant: 'destructive' });
      setStarting(false);
    }
  };

  const DIFF_BTN: Record<Diff, string> = {
    basic: 'bg-emerald-500/90 hover:bg-emerald-500 text-white',
    intermediate: 'bg-amber-500/90 hover:bg-amber-500 text-white',
    advanced: 'bg-rose-500/90 hover:bg-rose-500 text-white',
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <SEOHead title="Practice Arena — Test Your Edge | Online Textile School" description="Olympiad-style practice exams across 4 textile departments. 30 Q at once. Earn XP, climb the leaderboard." />
      <main className="flex-1 pb-16 lg:pb-0">
        <div className="container mx-auto px-4 py-6 md:py-10 max-w-6xl">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary-dark to-accent text-primary-foreground p-6 md:p-10 mb-6"
          >
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-accent/30 rounded-full blur-3xl" />
            <div className="relative">
              <Badge className="bg-white/20 hover:bg-white/30 border-0 mb-4">
                <Sparkles className="h-3 w-3 mr-1" /> Practice Arena
              </Badge>
              <h1 className="font-heading text-3xl md:text-5xl font-black mb-3 leading-tight">
                Test Your Edge.<br />Climb the Ranks.
              </h1>
              <p className="text-sm md:text-base opacity-90 max-w-2xl mb-5">
                30 questions per exam · 4 departments · Difficulty-wise leaderboard.
              </p>

              {globalStats && (
                <div className="grid grid-cols-3 gap-2 md:gap-4 mb-5 max-w-xl">
                  <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 text-center">
                    <p className="font-heading text-xl md:text-2xl font-bold">{globalStats.questions.toLocaleString()}</p>
                    <p className="text-[10px] opacity-80 uppercase">Questions</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 text-center">
                    <p className="font-heading text-xl md:text-2xl font-bold">{globalStats.exams.toLocaleString()}</p>
                    <p className="text-[10px] opacity-80 uppercase">Exams Taken</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 text-center">
                    <p className="font-heading text-xl md:text-2xl font-bold">{globalStats.students.toLocaleString()}</p>
                    <p className="text-[10px] opacity-80 uppercase">Students</p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {user && (
                  <>
                    <Button asChild variant="secondary" size="sm" className="font-bold">
                      <Link to="/dashboard/practice"><Sparkles className="h-4 w-4 mr-2" /> My Dashboard</Link>
                    </Button>
                    <Button asChild variant="secondary" size="sm" className="font-bold">
                      <Link to="/practice/history"><History className="h-4 w-4 mr-2" /> My History</Link>
                    </Button>
                  </>
                )}
                <Button asChild variant="outline" size="sm" className="bg-white/10 border-white/40 hover:bg-white/20 text-primary-foreground font-bold">
                  <Link to="/practice/leaderboard"><Trophy className="h-4 w-4 mr-2" /> Leaderboard</Link>
                </Button>
              </div>
            </div>
          </motion.div>

          {/* ⭐ Top — Mixed All-Departments Challenge */}
          <Card className="mb-8 border-2 border-accent/50 bg-gradient-to-br from-accent/10 via-background to-primary/5 overflow-hidden relative">
            <div className="absolute -top-10 -right-10 opacity-20">
              <Shuffle className="h-40 w-40 text-accent" />
            </div>
            <CardContent className="p-5 md:p-7 relative">
              <Badge className="bg-accent text-accent-foreground mb-3">
                <Sparkles className="h-3 w-3 mr-1" /> ALL DEPARTMENTS CHALLENGE
              </Badge>
              <h2 className="font-heading text-2xl md:text-3xl font-black mb-2">
                Mixed 30-Question Exam
              </h2>
              <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
                Random questions pulled equally from all 4 departments. Prove you're a true textile all-rounder.
              </p>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-xs font-semibold uppercase text-muted-foreground mr-1">Difficulty:</span>
                {(['basic', 'intermediate', 'advanced'] as Diff[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setMixedDiff(d)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold capitalize transition-all border-2 ${
                      mixedDiff === d ? DIFF_BTN[d] + ' border-transparent shadow-lg' : 'bg-background border-border hover:border-primary/40'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>

              <Button size="lg" onClick={startMixed} disabled={starting} className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold gap-2">
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                Start Mixed Exam
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

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

          {/* 4 Departments */}
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-heading text-2xl md:text-3xl font-bold">Or Pick a Department</h2>
            <span className="text-xs text-muted-foreground hidden md:inline">Choose difficulty next</span>
          </div>

          {isLoading ? (
            <div className="text-muted-foreground py-12 text-center animate-pulse">Loading...</div>
          ) : subjects.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">
              <Brain className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="font-heading font-bold text-lg">No departments available yet</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {subjects.map((s: any) => {
                const stat = myStats?.bySubject[s.id];
                return (
                  <Link key={s.id} to={`/practice/${s.slug}`} className="group">
                    <Card className="h-full hover:shadow-xl hover:-translate-y-1 transition-all border-2 hover:border-primary/40 overflow-hidden">
                      <CardContent className="p-6 flex items-center gap-5">
                        <div
                          className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl shrink-0"
                          style={{ background: s.color ? `${s.color}20` : 'hsl(var(--primary)/0.1)', color: s.color || 'hsl(var(--primary))' }}
                        >
                          {s.icon || '🧠'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-heading font-black text-xl md:text-2xl leading-tight">{s.name}</h3>
                          {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                          {stat && (
                            <p className="mt-2 text-xs">
                              <span className="text-muted-foreground">Your best: </span>
                              <span className="font-bold text-primary">{Math.round(stat.best)}%</span>
                            </p>
                          )}
                        </div>
                        <ArrowRight className="h-6 w-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
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
