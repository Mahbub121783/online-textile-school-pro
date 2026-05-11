import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, XCircle, Trophy, Clock, RefreshCw, History, Brain,
  Zap, Flame, Shield, Share2, Award,
} from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import { useAuth } from '@/hooks/useAuth';

const useCountUp = (target: number, duration = 1200) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
};

const grade = (pct: number) => {
  if (pct >= 95) return { letter: 'S', color: 'from-amber-400 to-orange-500' };
  if (pct >= 85) return { letter: 'A', color: 'from-emerald-500 to-teal-500' };
  if (pct >= 70) return { letter: 'B', color: 'from-sky-500 to-blue-500' };
  if (pct >= 50) return { letter: 'C', color: 'from-violet-500 to-purple-500' };
  return { letter: 'D', color: 'from-rose-500 to-pink-500' };
};

const PracticeResult = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const confettiFired = useRef(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['qb-result', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('qb_get_session_result', { _session_id: sessionId! });
      if (error) throw error;
      return data as any;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['qb-user-stats', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('qb_user_stats').select('*').eq('user_id', user!.id).maybeSingle();
      return data;
    },
  });

  const { data: badges = [] } = useQuery({
    queryKey: ['qb-user-badges', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('qb_user_badges')
        .select('badge_key, earned_at, qb_badges(name, description, icon, tier)')
        .eq('user_id', user!.id)
        .order('earned_at', { ascending: false });
      return data ?? [];
    },
  });

  const session = data?.session;
  const subject = data?.subject;
  const questions = data?.questions || [];
  const correctCount = questions.filter((q: any) => q.is_correct).length;
  const pct = session ? Math.round(Number(session.percentage)) : 0;
  const animatedPct = useCountUp(pct);
  const xp = session?.xp_earned || 0;
  const animatedXp = useCountUp(xp);
  const recentlyEarned = (badges as any[]).filter(
    (b) => session && new Date(b.earned_at).getTime() >= new Date(session.submitted_at).getTime() - 5000,
  );

  // Confetti for high scores
  useEffect(() => {
    if (!session || confettiFired.current) return;
    if (pct >= 80) {
      confettiFired.current = true;
      const end = Date.now() + 1500;
      const fire = () => {
        confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 } });
        if (Date.now() < end) requestAnimationFrame(fire);
      };
      fire();
    }
  }, [session, pct]);

  if (isLoading) return <div className="container mx-auto py-20 text-center text-muted-foreground animate-pulse">Loading result...</div>;
  if (!data || !session) return <div className="container mx-auto py-20 text-center">Result not available.</div>;

  const minutes = Math.floor(session.time_taken_seconds / 60);
  const seconds = session.time_taken_seconds % 60;
  const g = grade(pct);
  const visibleReviews = showAllReviews ? questions : questions.slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <SEOHead title={`${pct}% — Practice Result`} description="Your practice exam result" />
      <div className="container mx-auto px-4 py-8 max-w-4xl">

        {/* Hero score reveal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="overflow-hidden border-2">
            <CardContent className={`p-0 bg-gradient-to-br ${g.color} text-white`}>
              <div className="p-8 md:p-12 text-center relative">
                <div className="absolute top-4 right-4">
                  <Badge className="bg-white/20 hover:bg-white/30 border-0 text-white">
                    {session.passed ? '🎉 Passed' : 'Try again'}
                  </Badge>
                </div>

                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', delay: 0.2, duration: 0.8 }}
                  className="inline-flex items-center justify-center w-32 h-32 md:w-40 md:h-40 rounded-full bg-white/15 backdrop-blur border-4 border-white/30 font-heading text-7xl md:text-8xl font-black mb-4"
                >
                  {g.letter}
                </motion.div>

                <p className="text-7xl md:text-8xl font-heading font-black tabular-nums">
                  {animatedPct}<span className="text-4xl md:text-5xl opacity-70">%</span>
                </p>
                <p className="text-lg opacity-90 mt-2">
                  {correctCount} of {questions.length} correct • {subject?.name}
                </p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10">
                <div className="bg-black/20 p-4 text-center">
                  <Zap className="h-5 w-5 mx-auto mb-1 opacity-80" />
                  <p className="text-2xl font-heading font-bold tabular-nums">+{animatedXp}</p>
                  <p className="text-[11px] opacity-80 uppercase tracking-wide">XP Earned</p>
                </div>
                <div className="bg-black/20 p-4 text-center">
                  <Flame className="h-5 w-5 mx-auto mb-1 opacity-80" />
                  <p className="text-2xl font-heading font-bold tabular-nums">{stats?.current_streak ?? 0}</p>
                  <p className="text-[11px] opacity-80 uppercase tracking-wide">Day Streak</p>
                </div>
                <div className="bg-black/20 p-4 text-center">
                  <Clock className="h-5 w-5 mx-auto mb-1 opacity-80" />
                  <p className="text-2xl font-heading font-bold tabular-nums">{minutes}:{String(seconds).padStart(2, '0')}</p>
                  <p className="text-[11px] opacity-80 uppercase tracking-wide">Time</p>
                </div>
                <div className="bg-black/20 p-4 text-center">
                  <Trophy className="h-5 w-5 mx-auto mb-1 opacity-80" />
                  <p className="text-2xl font-heading font-bold tabular-nums">{stats?.total_xp ?? xp}</p>
                  <p className="text-[11px] opacity-80 uppercase tracking-wide">Total XP</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* New badges */}
        {recentlyEarned.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-6"
          >
            <Card className="border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30">
              <CardContent className="p-5">
                <h3 className="font-heading font-bold text-lg mb-3 flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-600" /> Badges Unlocked!
                </h3>
                <div className="flex flex-wrap gap-3">
                  {recentlyEarned.map((b: any, i: number) => (
                    <motion.div
                      key={b.badge_key}
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.8 + i * 0.15, type: 'spring' }}
                      className="bg-background rounded-xl p-3 border-2 border-amber-300 min-w-[140px] text-center"
                    >
                      <div className="text-4xl mb-1">{b.qb_badges?.icon}</div>
                      <p className="font-bold text-sm">{b.qb_badges?.name}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{b.qb_badges?.description}</p>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Integrity report */}
        {session.violation_count > 0 && (
          <Card className="mt-6 border-amber-300">
            <CardContent className="p-4 flex items-center gap-3">
              <Shield className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-semibold">Integrity Report</p>
                <p className="text-muted-foreground text-xs">
                  {session.violation_count} warning{session.violation_count > 1 ? 's' : ''} recorded during this exam.
                  {session.focus_mode_used ? ' Focus mode was used.' : ''}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-6">
          <Button asChild className="flex-1 sm:flex-none">
            <Link to={`/practice/${subject?.slug}`}><RefreshCw className="h-4 w-4 mr-1" /> Try Again</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1 sm:flex-none">
            <Link to="/practice/leaderboard"><Trophy className="h-4 w-4 mr-1" /> Leaderboard</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1 sm:flex-none">
            <Link to="/practice/history"><History className="h-4 w-4 mr-1" /> History</Link>
          </Button>
          <Button asChild variant="ghost" className="flex-1 sm:flex-none">
            <Link to="/practice"><Brain className="h-4 w-4 mr-1" /> All Subjects</Link>
          </Button>
          <Button
            variant="ghost"
            className="flex-1 sm:flex-none"
            onClick={async () => {
              const text = `I scored ${pct}% on ${subject?.name} practice exam! 🎯`;
              if (navigator.share) {
                try { await navigator.share({ title: 'My Practice Score', text, url: window.location.href }); }
                catch { /* user cancelled */ }
              } else {
                navigator.clipboard.writeText(`${text} ${window.location.href}`);
              }
            }}
          >
            <Share2 className="h-4 w-4 mr-1" /> Share
          </Button>
        </div>

        {/* Answer review */}
        <h2 className="font-heading text-2xl font-bold mt-10 mb-4">Answer Review</h2>
        <div className="space-y-3">
          {visibleReviews.map((q: any, i: number) => {
            const correct = q.is_correct;
            const userAns = q.selected_answer;
            return (
              <Card key={q.id} className={`border-l-4 ${correct ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    {correct ? <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" /> : <XCircle className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />}
                    <div className="flex-1">
                      <p className="font-medium mb-3"><span className="text-muted-foreground mr-2">Q{i + 1}.</span>{q.question_text}</p>

                      {q.question_type === 'multiple_choice' && Array.isArray(q.options) && (
                        <div className="space-y-1.5 mb-3">
                          {q.options.map((opt: string, j: number) => {
                            const isCorrect = opt === q.correct_answer;
                            const isUser = opt === userAns;
                            return (
                              <div key={j} className={`text-sm px-3 py-2 rounded-lg flex items-center gap-2 ${
                                isCorrect ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200' :
                                isUser ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200' : 'bg-muted/40'
                              }`}>
                                <span className="font-mono font-bold w-5">{String.fromCharCode(65 + j)}.</span>
                                <span className="flex-1">{opt}</span>
                                {isCorrect && <Badge variant="default" className="text-[10px] bg-emerald-600">Correct</Badge>}
                                {isUser && !isCorrect && <Badge variant="destructive" className="text-[10px]">Your answer</Badge>}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {(q.question_type === 'true_false' || q.question_type === 'short_answer') && (
                        <div className="space-y-1.5 mb-3 text-sm">
                          <p>Your answer: <span className={correct ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{userAns || '—'}</span></p>
                          {!correct && <p>Correct answer: <span className="text-emerald-600 font-bold">{q.correct_answer}</span></p>}
                        </div>
                      )}

                      {q.explanation && (
                        <div className="mt-3 p-3 bg-muted/40 rounded-lg text-sm border-l-2 border-primary">
                          <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Explanation</p>
                          <p>{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {questions.length > 5 && !showAllReviews && (
          <Button variant="outline" className="w-full mt-4" onClick={() => setShowAllReviews(true)}>
            Show all {questions.length} questions
          </Button>
        )}
      </div>
    </div>
  );
};

export default PracticeResult;
