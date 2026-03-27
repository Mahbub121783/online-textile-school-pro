import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { ArrowLeft, Download, Eye, CheckCircle2, XCircle, Clock, Save, Trophy, Users, TrendingUp, Target } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  quizId: string;
  onBack: () => void;
}

interface RankedAttempt {
  id: string;
  score: number;
  total_points: number;
  percentage: number;
  passed: boolean;
  time_spent_seconds: number | null;
  completed_at: string | null;
  started_at: string | null;
  admin_feedback: string | null;
  manual_overrides: any;
  answers: any;
  user_id: string;
  user_profiles: { full_name: string | null; avatar_url: string | null; roll_id: string | null } | null;
  position: number;
}

const QuizResultsBoard = ({ quizId, onBack }: Props) => {
  const qc = useQueryClient();
  const [justifyView, setJustifyView] = useState<RankedAttempt | null>(null);
  const [feedback, setFeedback] = useState('');
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const { data: quiz } = useQuery({
    queryKey: ['quiz-results-quiz', quizId],
    queryFn: async () => {
      const { data } = await supabase.from('quizzes').select('*, courses!quizzes_course_id_fkey(title)').eq('id', quizId).single();
      return data;
    },
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['quiz-results-questions', quizId],
    queryFn: async () => {
      const { data } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quizId).order('sort_order');
      return data ?? [];
    },
  });

  const { data: rawAttempts = [] } = useQuery({
    queryKey: ['quiz-results-attempts', quizId],
    queryFn: async () => {
      const { data } = await supabase
        .from('quiz_attempts')
        .select('*, user_profiles!quiz_attempts_user_id_fkey(full_name, avatar_url, roll_id)')
        .eq('quiz_id', quizId)
        .order('percentage', { ascending: false });
      return data ?? [];
    },
  });

  // Intelligent ranking with tie handling
  const rankedAttempts: RankedAttempt[] = useMemo(() => {
    const sorted = [...rawAttempts].sort((a: any, b: any) => {
      const pDiff = (b.percentage ?? 0) - (a.percentage ?? 0);
      if (pDiff !== 0) return pDiff;
      return (a.time_spent_seconds ?? Infinity) - (b.time_spent_seconds ?? Infinity);
    });

    let currentPosition = 1;
    return sorted.map((attempt: any, idx: number) => {
      if (idx > 0) {
        const prev = sorted[idx - 1] as any;
        if (attempt.percentage !== prev.percentage) {
          currentPosition = idx + 1;
        }
      }
      return { ...attempt, position: currentPosition };
    });
  }, [rawAttempts]);

  // Stats
  const stats = useMemo(() => {
    if (rankedAttempts.length === 0) return { total: 0, avg: 0, passRate: 0, highest: 0 };
    const total = rankedAttempts.length;
    const avg = Math.round(rankedAttempts.reduce((s, a) => s + (a.percentage ?? 0), 0) / total);
    const passRate = Math.round((rankedAttempts.filter(a => a.passed).length / total) * 100);
    const highest = Math.max(...rankedAttempts.map(a => a.percentage ?? 0));
    return { total, avg, passRate, highest };
  }, [rankedAttempts]);

  const saveFeedback = useMutation({
    mutationFn: async ({ attemptId, fb, mo }: { attemptId: string; fb: string; mo: Record<string, number> }) => {
      let newScore = 0;
      let totalPoints = 0;
      questions.forEach((q: any) => {
        if (q.is_instruction) return;
        totalPoints += q.points || 1;
        const override = mo[q.id];
        if (override !== undefined) {
          newScore += override;
        } else {
          const userAns = justifyView?.answers?.[q.id] || '';
          if (String(userAns).trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()) {
            newScore += q.points || 1;
          }
        }
      });
      const percentage = totalPoints > 0 ? Math.round((newScore / totalPoints) * 100) : 0;
      const passed = percentage >= (quiz?.pass_percentage || 60);
      const { error } = await supabase.from('quiz_attempts').update({
        admin_feedback: fb, manual_overrides: mo, score: newScore,
        percentage, passed, total_points: totalPoints,
      }).eq('id', attemptId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quiz-results-attempts'] });
      toast.success('Feedback saved & rankings updated');
      setJustifyView(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const exportCSV = () => {
    const headers = ['Position', 'Student', 'Roll ID', 'Score', 'Total', 'Percentage', 'Passed', 'Time Spent', 'Date', 'Feedback'];
    const rows = rankedAttempts.map(a => [
      a.position, a.user_profiles?.full_name || 'Unknown', a.user_profiles?.roll_id || '-',
      a.score, a.total_points, `${a.percentage}%`, a.passed ? 'Yes' : 'No',
      a.time_spent_seconds ? `${Math.round(a.time_spent_seconds / 60)}m` : '-',
      a.completed_at ? format(new Date(a.completed_at), 'yyyy-MM-dd HH:mm') : 'In progress',
      a.admin_feedback || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `quiz-results-${quizId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const openJustify = (attempt: RankedAttempt) => {
    setJustifyView(attempt);
    setFeedback(attempt.admin_feedback || '');
    setOverrides(attempt.manual_overrides && typeof attempt.manual_overrides === 'object' ? attempt.manual_overrides as Record<string, number> : {});
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const positionBadge = (pos: number) => {
    if (pos === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-400 text-yellow-900 font-bold text-xs shadow">🥇</span>;
    if (pos === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-300 text-gray-800 font-bold text-xs shadow">🥈</span>;
    if (pos === 3) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-600 text-white font-bold text-xs shadow">🥉</span>;
    return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted text-muted-foreground font-semibold text-xs">{pos}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <div className="flex-1">
          <h2 className="font-heading font-bold text-lg">{quiz?.title || 'Quiz'} — Leaderboard</h2>
          <p className="text-xs text-muted-foreground">{quiz?.courses?.title} · Pass mark: {quiz?.pass_percentage || 60}%</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={exportCSV}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-4 w-4 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Submissions</p><p className="font-bold text-lg">{stats.total}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-blue-500" /></div>
          <div><p className="text-xs text-muted-foreground">Avg Score</p><p className="font-bold text-lg">{stats.avg}%</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center"><Target className="h-4 w-4 text-green-500" /></div>
          <div><p className="text-xs text-muted-foreground">Pass Rate</p><p className="font-bold text-lg">{stats.passRate}%</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-yellow-500/10 flex items-center justify-center"><Trophy className="h-4 w-4 text-yellow-500" /></div>
          <div><p className="text-xs text-muted-foreground">Highest</p><p className="font-bold text-lg">{stats.highest}%</p></div>
        </CardContent></Card>
      </div>

      {/* Leaderboard Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Roll ID</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedAttempts.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No submissions yet.</TableCell></TableRow>
              ) : rankedAttempts.map((a) => (
                <TableRow key={a.id} className={a.position <= 3 ? 'bg-accent/5' : ''}>
                  <TableCell className="text-center">{positionBadge(a.position)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={a.user_profiles?.avatar_url || ''} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(a.user_profiles?.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm truncate max-w-[140px]">{a.user_profiles?.full_name || 'Unknown'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{a.user_profiles?.roll_id || '—'}</TableCell>
                  <TableCell>
                    <span className="text-sm font-semibold">{a.score}/{a.total_points}</span>
                    <span className="text-xs text-muted-foreground ml-1">({a.percentage}%)</span>
                  </TableCell>
                  <TableCell>
                    {a.passed ? (
                      <Badge variant="default" className="gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3" /> Pass</Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1 text-[10px]"><XCircle className="h-3 w-3" /> Fail</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{a.time_spent_seconds ? `${Math.round(a.time_spent_seconds / 60)}m ${a.time_spent_seconds % 60}s` : '—'}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.completed_at ? format(new Date(a.completed_at), 'MMM d, HH:mm') : 'In progress'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openJustify(a)}>
                      <Eye className="h-3 w-3" /> Justify
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Justify Dialog */}
      <Dialog open={!!justifyView} onOpenChange={o => !o && setJustifyView(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={justifyView?.user_profiles?.avatar_url || ''} />
                <AvatarFallback className="text-xs">{getInitials(justifyView?.user_profiles?.full_name)}</AvatarFallback>
              </Avatar>
              <div>
                <p>{justifyView?.user_profiles?.full_name}</p>
                <p className="text-xs font-normal text-muted-foreground">
                  {justifyView?.user_profiles?.roll_id || 'No ID'} · Position #{justifyView?.position}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {questions.map((q: any, idx: number) => {
              if (q.is_instruction) return (
                <div key={q.id} className="p-3 bg-muted/50 rounded-lg text-sm italic">📋 {q.question_text}</div>
              );
              const userAns = justifyView?.answers?.[q.id] || '';
              const isCorrect = String(userAns).trim().toLowerCase() === q.correct_answer?.trim().toLowerCase();
              return (
                <div key={q.id} className={`p-3 rounded-lg border ${isCorrect ? 'border-green-200 bg-green-50/50 dark:bg-green-950/10' : 'border-red-200 bg-red-50/50 dark:bg-red-950/10'}`}>
                  <p className="font-medium text-sm">Q{idx + 1}. {q.question_text}</p>
                  <p className="text-sm mt-1">Answer: <span className={isCorrect ? 'text-green-600 font-medium' : 'text-destructive font-medium'}>{userAns || '(empty)'}</span></p>
                  {!isCorrect && <p className="text-sm text-green-600">Correct: {q.correct_answer}</p>}
                  {(q.question_type === 'short_answer' || !isCorrect) && (
                    <div className="mt-2 flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Override:</Label>
                      <Input type="number" className="h-7 w-20 text-xs" value={overrides[q.id] ?? ''} placeholder={String(q.points || 1)}
                        onChange={e => setOverrides(prev => {
                          const val = e.target.value;
                          if (val === '') { const { [q.id]: _, ...rest } = prev; return rest; }
                          return { ...prev, [q.id]: Number(val) };
                        })} />
                      <span className="text-xs text-muted-foreground">/ {q.points || 1}</span>
                    </div>
                  )}
                </div>
              );
            })}

            <div>
              <Label className="text-xs">Admin Justification / Feedback</Label>
              <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} placeholder="Explain score adjustments or provide feedback..." />
            </div>

            <Button className="w-full gap-1 bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => justifyView && saveFeedback.mutate({ attemptId: justifyView.id, fb: feedback, mo: overrides })}
              disabled={saveFeedback.isPending}>
              <Save className="h-4 w-4" /> {saveFeedback.isPending ? 'Saving...' : 'Save & Re-rank'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuizResultsBoard;
