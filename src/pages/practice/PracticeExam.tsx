import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, Flag, ChevronLeft, ChevronRight, Send, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface Question {
  id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  options: string[];
  points: number;
}

const PracticeExam = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [timeLimit, setTimeLimit] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [remaining, setRemaining] = useState<number>(0);
  const startedRef = useRef<number>(Date.now());
  const qStartRef = useRef<number>(Date.now());
  const timeSpentRef = useRef<Record<string, number>>({});

  // Load session questions (uses qb_start_exam result cached at session creation)
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      // Re-fetch via direct query since start_exam already created the session — we get question_ids and pull sanitized
      const { data: session, error } = await supabase
        .from('qb_exam_sessions')
        .select('question_ids, time_limit_seconds, started_at, submitted_at')
        .eq('id', sessionId)
        .maybeSingle();
      if (error || !session) {
        toast({ title: 'Session not found', variant: 'destructive' });
        navigate('/practice');
        return;
      }
      if (session.submitted_at) {
        navigate(`/practice/result/${sessionId}`);
        return;
      }
      const { data: qs } = await supabase
        .from('qb_questions')
        .select('id, question_text, question_type, options, points')
        .in('id', session.question_ids);
      const ordered = (session.question_ids as string[]).map((id) => (qs ?? []).find((q: any) => q.id === id)).filter(Boolean) as any[];
      // shuffle options client-side for MCQ
      const final = ordered.map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? [...q.options].sort(() => Math.random() - 0.5) : [],
      }));
      setQuestions(final);
      setTimeLimit(session.time_limit_seconds || 1800);
      const elapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
      setRemaining(Math.max(0, (session.time_limit_seconds || 1800) - elapsed));
      startedRef.current = new Date(session.started_at).getTime();
      qStartRef.current = Date.now();
      setLoading(false);
    })();
  }, [sessionId, navigate]);

  // Countdown
  useEffect(() => {
    if (loading) return;
    const iv = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(iv);
          handleSubmit(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const trackTimeSpent = (qid: string) => {
    const spent = Math.floor((Date.now() - qStartRef.current) / 1000);
    timeSpentRef.current[qid] = (timeSpentRef.current[qid] || 0) + spent;
    qStartRef.current = Date.now();
  };

  const goTo = (i: number) => {
    if (questions[idx]) trackTimeSpent(questions[idx].id);
    setIdx(Math.max(0, Math.min(i, questions.length - 1)));
  };

  const toggleFlag = (qid: string) => {
    setFlagged((p) => {
      const n = new Set(p);
      n.has(qid) ? n.delete(qid) : n.add(qid);
      return n;
    });
  };

  const setAnswer = (qid: string, val: string) => setAnswers((p) => ({ ...p, [qid]: val }));

  const handleSubmit = async (auto = false) => {
    if (submitting) return;
    if (questions[idx]) trackTimeSpent(questions[idx].id);
    setSubmitting(true);
    setConfirmSubmit(false);
    try {
      const payload = questions.map((q) => ({
        question_id: q.id,
        selected_answer: answers[q.id] ?? null,
        time_spent_seconds: timeSpentRef.current[q.id] || 0,
      }));
      const { error } = await supabase.rpc('qb_submit_exam', { _session_id: sessionId!, _answers: payload });
      if (error) throw error;
      if (auto) toast({ title: 'Time up!', description: 'Exam auto-submitted.' });
      navigate(`/practice/result/${sessionId}`);
    } catch (e: any) {
      toast({ title: 'Submit failed', description: e.message, variant: 'destructive' });
      setSubmitting(false);
    }
  };

  const answered = useMemo(() => Object.keys(answers).filter((k) => answers[k] !== '' && answers[k] != null).length, [answers]);
  const percent = questions.length ? (answered / questions.length) * 100 : 0;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading exam...</div>;
  }

  const q = questions[idx];
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const lowTime = remaining < 120;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3 max-w-5xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Badge variant="outline">Q {idx + 1} / {questions.length}</Badge>
            <div className="hidden sm:block flex-1 min-w-[100px]">
              <Progress value={percent} className="h-1.5" />
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">{answered} answered</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 font-mono font-bold px-3 py-1 rounded-lg ${lowTime ? 'bg-destructive/15 text-destructive animate-pulse' : 'bg-muted'}`}>
              <Clock className="h-4 w-4" />
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
            <Button size="sm" onClick={() => setConfirmSubmit(true)} disabled={submitting}>
              <Send className="h-4 w-4 mr-1" /> Submit
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-5xl grid lg:grid-cols-[1fr_220px] gap-6">
        {/* Question card */}
        <Card>
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{q.points} pt{q.points > 1 ? 's' : ''}</Badge>
                <Badge variant="outline" className="capitalize">{q.question_type.replace('_', ' ')}</Badge>
              </div>
              <Button variant={flagged.has(q.id) ? 'default' : 'ghost'} size="sm" onClick={() => toggleFlag(q.id)}>
                <Flag className="h-4 w-4 mr-1" /> {flagged.has(q.id) ? 'Flagged' : 'Flag'}
              </Button>
            </div>

            <h2 className="font-heading text-lg md:text-xl font-bold leading-relaxed mb-6 whitespace-pre-wrap">{q.question_text}</h2>

            {q.question_type === 'multiple_choice' && (
              <div className="space-y-2">
                {q.options.map((opt, i) => {
                  const selected = answers[q.id] === opt;
                  return (
                    <button
                      key={i}
                      onClick={() => setAnswer(q.id, opt)}
                      className={`w-full text-left border-2 rounded-xl p-4 transition-all ${selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 hover:bg-muted/50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center font-bold text-sm ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'}`}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1">{opt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {q.question_type === 'true_false' && (
              <div className="grid grid-cols-2 gap-3">
                {['True', 'False'].map((v) => {
                  const selected = answers[q.id] === v;
                  return (
                    <button
                      key={v}
                      onClick={() => setAnswer(q.id, v)}
                      className={`border-2 rounded-xl p-6 font-heading font-bold text-lg transition-all ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'}`}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            )}

            {q.question_type === 'short_answer' && (
              <input
                type="text"
                value={answers[q.id] || ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="Type your answer..."
                className="w-full border-2 rounded-xl p-4 text-base bg-background focus:border-primary outline-none"
              />
            )}

            <div className="flex items-center justify-between mt-8 pt-6 border-t">
              <Button variant="outline" disabled={idx === 0} onClick={() => goTo(idx - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              {idx < questions.length - 1 ? (
                <Button onClick={() => goTo(idx + 1)}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={() => setConfirmSubmit(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  <Send className="h-4 w-4 mr-1" /> Submit Exam
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Question palette */}
        <Card className="hidden lg:block h-fit sticky top-20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">Questions</p>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((qq, i) => {
                const isAnswered = answers[qq.id] != null && answers[qq.id] !== '';
                const isFlagged = flagged.has(qq.id);
                const isCurrent = i === idx;
                return (
                  <button
                    key={qq.id}
                    onClick={() => goTo(i)}
                    className={`h-8 rounded text-xs font-bold relative transition-all ${
                      isCurrent ? 'ring-2 ring-primary ring-offset-1' : ''
                    } ${isAnswered ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted-foreground/20'}`}
                  >
                    {i + 1}
                    {isFlagged && <Flag className="absolute -top-1 -right-1 h-3 w-3 text-amber-500 fill-amber-500" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-1.5 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-primary" /> Answered</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-muted" /> Unanswered</div>
              <div className="flex items-center gap-2"><Flag className="h-3 w-3 text-amber-500 fill-amber-500" /> Flagged</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit exam?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            You have answered <strong>{answered}</strong> of <strong>{questions.length}</strong> questions.
            {answered < questions.length && ` ${questions.length - answered} unanswered will be marked wrong.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSubmit(false)} disabled={submitting}>Keep going</Button>
            <Button onClick={() => handleSubmit(false)} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PracticeExam;
