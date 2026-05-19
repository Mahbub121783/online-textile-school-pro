import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Flag, Send, Loader2, Maximize2, Minimize2, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useExamIntegrity } from '@/hooks/useExamIntegrity';
import { useExamHeartbeat } from '@/hooks/useExamHeartbeat';
import { IntegrityBanner } from '@/components/practice/IntegrityBanner';

interface Question {
  id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  options: string[];
  points: number;
}

const LS_KEY = (sid: string) => `qb-exam-backup-${sid}`;

const PracticeExam = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [timeLimit, setTimeLimit] = useState(0);
  const [difficulty, setDifficulty] = useState<'basic' | 'intermediate' | 'advanced' | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const qRefs = useRef<(HTMLDivElement | null)[]>([]);

  const integrity = useExamIntegrity({ sessionId, enabled: !loading });
  useExamHeartbeat(sessionId, !loading);

  // Load session
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data: session, error } = await supabase
        .from('qb_exam_sessions')
        .select('question_ids, time_limit_seconds, started_at, submitted_at, resume_count, difficulty')
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
      const ordered = (session.question_ids as string[])
        .map((id) => (qs ?? []).find((q: any) => q.id === id))
        .filter(Boolean) as any[];
      const final = ordered.map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? [...q.options].sort(() => Math.random() - 0.5) : [],
      }));
      setQuestions(final);
      setTimeLimit(session.time_limit_seconds || 1800);
      setDifficulty(session.difficulty as any);

      try {
        const raw = localStorage.getItem(LS_KEY(sessionId));
        if (raw) {
          const backup = JSON.parse(raw);
          if (backup.answers) setAnswers(backup.answers);
          if (backup.flagged) setFlagged(new Set(backup.flagged));
        }
      } catch { /* ignore */ }

      const elapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
      setRemaining(Math.max(0, (session.time_limit_seconds || 1800) - elapsed));
      setLoading(false);

      if (elapsed > 5) {
        setTimeout(() => integrity.log('session_resumed', { elapsed }), 500);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Persist locally
  useEffect(() => {
    if (!sessionId || loading) return;
    try {
      localStorage.setItem(LS_KEY(sessionId), JSON.stringify({ answers, flagged: Array.from(flagged), ts: Date.now() }));
      setSavedFlash(true);
      const t = setTimeout(() => setSavedFlash(false), 800);
      return () => clearTimeout(t);
    } catch { /* ignore */ }
  }, [answers, flagged, sessionId, loading]);

  // Countdown
  useEffect(() => {
    if (loading) return;
    const iv = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(iv); handleSubmit(true); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Track scrolled-into-view question
  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const idx = Number((visible[0].target as HTMLElement).dataset.idx);
          if (!isNaN(idx)) setActiveIdx(idx);
        }
      },
      { threshold: [0.3, 0.6] },
    );
    qRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [loading, questions.length]);

  const setAnswer = useCallback((qid: string, val: string) => setAnswers((p) => ({ ...p, [qid]: val })), []);
  const toggleFlag = useCallback((qid: string) => setFlagged((p) => {
    const n = new Set(p);
    n.has(qid) ? n.delete(qid) : n.add(qid);
    return n;
  }), []);
  const scrollToQ = (i: number) => qRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const enterFocus = async () => {
    try { await containerRef.current?.requestFullscreen(); setFocusMode(true); integrity.log('focus_mode_entered'); }
    catch { setFocusMode(true); }
  };
  const exitFocus = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ignore */ }
    setFocusMode(false);
  };
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setFocusMode(false); };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const handleSubmit = async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    setConfirmSubmit(false);
    try {
      const payload = questions.map((q) => ({
        question_id: q.id,
        selected_answer: answers[q.id] ?? null,
        time_spent_seconds: 0,
      }));
      const { error } = await supabase.rpc('qb_submit_exam', { _session_id: sessionId!, _answers: payload as never });
      if (error) throw error;
      if (sessionId) localStorage.removeItem(LS_KEY(sessionId));
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      if (auto) toast({ title: 'Time up!', description: 'Exam auto-submitted.' });
      navigate(`/practice/result/${sessionId}`);
    } catch (e: any) {
      toast({ title: 'Submit failed', description: e.message, variant: 'destructive' });
      setSubmitting(false);
    }
  };

  const answered = useMemo(
    () => Object.keys(answers).filter((k) => answers[k] !== '' && answers[k] != null).length,
    [answers],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground bg-background">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading exam...
      </div>
    );
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const lowTime = remaining < 120;
  const veryLow = remaining < 30;
  const timerColor = veryLow
    ? 'bg-destructive text-destructive-foreground animate-pulse'
    : lowTime ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white';

  const shellClass = focusMode ? 'min-h-screen bg-slate-950 text-slate-100' : 'min-h-screen bg-muted/30';

  return (
    <div ref={containerRef} className={shellClass}>
      {/* Sticky header */}
      <div className={`sticky top-0 z-20 backdrop-blur border-b ${focusMode ? 'bg-slate-950/95 border-slate-800' : 'bg-background/95'}`}>
        <div className="container mx-auto px-3 sm:px-4 py-2.5 max-w-6xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className={focusMode ? 'border-slate-700 text-slate-200' : ''}>
              Q {activeIdx + 1}/{questions.length}
            </Badge>
            <span className="text-xs text-muted-foreground hidden md:inline">{answered} answered</span>
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <Save className={`h-3 w-3 transition-opacity ${savedFlash ? 'text-emerald-500 opacity-100' : 'opacity-40'}`} />
              <span className="hidden md:inline">Saved</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {difficulty && (
              <Badge variant="outline" className={`text-[10px] ${focusMode ? 'border-rose-700 text-rose-300' : 'border-rose-300 text-rose-600'}`}>
                −{difficulty === 'basic' ? 15 : difficulty === 'intermediate' ? 20 : 25}% / wrong
              </Badge>
            )}
            <IntegrityBanner count={integrity.count} focusMode={focusMode} />
            <div className={`flex items-center gap-1.5 font-mono font-bold px-2.5 sm:px-3 py-1 rounded-lg text-sm ${timerColor}`}>
              <Clock className="h-4 w-4" />
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
            {!focusMode ? (
              <Button size="sm" variant="outline" onClick={enterFocus} className="hidden sm:flex">
                <Maximize2 className="h-4 w-4 mr-1" /> Focus
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={exitFocus} className="hidden sm:flex bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800">
                <Minimize2 className="h-4 w-4 mr-1" /> Exit
              </Button>
            )}
            <Button size="sm" onClick={() => setConfirmSubmit(true)} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Send className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Submit</span>
            </Button>
          </div>
        </div>
        <div className="h-1 bg-muted/40">
          <div className="h-full bg-primary transition-all" style={{ width: `${(answered / questions.length) * 100}%` }} />
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl grid lg:grid-cols-[1fr_220px] gap-4 lg:gap-6">
        {/* All questions stacked */}
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} ref={(el) => (qRefs.current[i] = el)} data-idx={i} className="scroll-mt-20">
              <Card className={focusMode ? 'bg-slate-900 border-slate-800 text-slate-100' : ''}>
                <CardContent className="p-5 md:p-7">
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-primary/15 text-primary border-0 font-bold">#{i + 1}</Badge>
                      <Badge variant="secondary">{q.points} pt{q.points > 1 ? 's' : ''}</Badge>
                      <Badge variant="outline" className={`capitalize ${focusMode ? 'border-slate-700 text-slate-300' : ''}`}>
                        {q.question_type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <Button
                      variant={flagged.has(q.id) ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => toggleFlag(q.id)}
                      className={focusMode && !flagged.has(q.id) ? 'text-slate-300 hover:bg-slate-800' : ''}
                    >
                      <Flag className="h-4 w-4 mr-1" /> {flagged.has(q.id) ? 'Flagged' : 'Flag'}
                    </Button>
                  </div>

                  <h2 className="font-heading text-base md:text-lg font-bold leading-relaxed mb-4 whitespace-pre-wrap select-none">
                    {q.question_text}
                  </h2>

                  {q.question_type === 'multiple_choice' && (
                    <div className="space-y-2">
                      {q.options.map((opt, j) => {
                        const selected = answers[q.id] === opt;
                        const base = focusMode
                          ? selected ? 'border-primary bg-primary/20' : 'border-slate-700 hover:border-primary/60 hover:bg-slate-800'
                          : selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 hover:bg-muted/50';
                        return (
                          <button
                            key={j}
                            onClick={() => setAnswer(q.id, opt)}
                            className={`w-full text-left border-2 rounded-xl p-3 md:p-3.5 transition-all select-none ${base}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center font-bold text-sm ${
                                selected ? 'border-primary bg-primary text-primary-foreground'
                                : focusMode ? 'border-slate-600 text-slate-400' : 'border-muted-foreground/30'
                              }`}>
                                {String.fromCharCode(65 + j)}
                              </span>
                              <span className="flex-1 text-sm md:text-base">{opt}</span>
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
                            className={`border-2 rounded-xl p-5 font-heading font-bold transition-all ${
                              selected ? 'border-primary bg-primary/15 text-primary'
                              : focusMode ? 'border-slate-700 hover:border-primary/40' : 'border-border hover:border-primary/40'
                            }`}
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
                      className={`w-full border-2 rounded-xl p-3 text-sm md:text-base outline-none focus:border-primary ${
                        focusMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-background'
                      }`}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          ))}

          <div className="flex justify-center pt-4">
            <Button size="lg" onClick={() => setConfirmSubmit(true)} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white px-10">
              <Send className="h-5 w-5 mr-2" /> Submit Exam ({answered}/{questions.length})
            </Button>
          </div>
        </div>

        {/* Question palette */}
        <Card className={`hidden lg:block h-fit sticky top-20 ${focusMode ? 'bg-slate-900 border-slate-800 text-slate-100' : ''}`}>
          <CardContent className="p-4">
            <p className={`text-xs font-semibold uppercase mb-3 ${focusMode ? 'text-slate-400' : 'text-muted-foreground'}`}>Questions</p>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((qq, i) => {
                const isAnswered = answers[qq.id] != null && answers[qq.id] !== '';
                const isFlagged = flagged.has(qq.id);
                const isCurrent = i === activeIdx;
                const cls = isAnswered
                  ? 'bg-primary text-primary-foreground'
                  : focusMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-muted hover:bg-muted-foreground/20';
                return (
                  <button
                    key={qq.id}
                    onClick={() => scrollToQ(i)}
                    className={`h-8 rounded text-xs font-bold relative transition-all ${cls} ${isCurrent ? 'ring-2 ring-accent ring-offset-1' : ''}`}
                  >
                    {i + 1}
                    {isFlagged && <Flag className="absolute -top-1 -right-1 h-3 w-3 text-amber-500 fill-amber-500" />}
                  </button>
                );
              })}
            </div>
            <div className={`mt-4 space-y-1.5 text-[11px] ${focusMode ? 'text-slate-400' : 'text-muted-foreground'}`}>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-primary" /> Answered</div>
              <div className="flex items-center gap-2"><span className={`w-3 h-3 rounded ${focusMode ? 'bg-slate-800' : 'bg-muted'}`} /> Unanswered</div>
              <div className="flex items-center gap-2"><Flag className="h-3 w-3 text-amber-500 fill-amber-500" /> Flagged</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit exam?</DialogTitle></DialogHeader>
          <DialogDescription>
            You have answered <strong>{answered}</strong> of <strong>{questions.length}</strong> questions.
            {answered < questions.length && ` ${questions.length - answered} unanswered will be marked wrong.`}
            {integrity.count > 0 && (
              <span className="block mt-2 text-amber-600">
                ⚠ {integrity.count} integrity warning{integrity.count > 1 ? 's' : ''} recorded.
              </span>
            )}
          </DialogDescription>
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
