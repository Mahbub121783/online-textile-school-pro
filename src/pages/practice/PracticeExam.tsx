import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Clock, Flag, ChevronLeft, ChevronRight, Send, Loader2,
  Maximize2, Minimize2, Save, Keyboard,
} from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [direction, setDirection] = useState(1);
  const qStartRef = useRef<number>(Date.now());
  const timeSpentRef = useRef<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const integrity = useExamIntegrity({ sessionId, enabled: !loading });
  useExamHeartbeat(sessionId, !loading);

  // Load session
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data: session, error } = await supabase
        .from('qb_exam_sessions')
        .select('question_ids, time_limit_seconds, started_at, submitted_at, resume_count')
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

      // Restore answers from localStorage backup
      try {
        const raw = localStorage.getItem(LS_KEY(sessionId));
        if (raw) {
          const backup = JSON.parse(raw);
          if (backup.answers) setAnswers(backup.answers);
          if (backup.flagged) setFlagged(new Set(backup.flagged));
          if (backup.idx) setIdx(backup.idx);
        }
      } catch { /* ignore */ }

      const elapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
      setRemaining(Math.max(0, (session.time_limit_seconds || 1800) - elapsed));
      qStartRef.current = Date.now();
      setLoading(false);

      // Detect resume
      const isResume = elapsed > 5; // arrived after server started
      if (isResume) {
        setTimeout(() => integrity.log('session_resumed', { elapsed }), 500);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Persist to localStorage on every change
  useEffect(() => {
    if (!sessionId || loading) return;
    try {
      localStorage.setItem(
        LS_KEY(sessionId),
        JSON.stringify({ answers, flagged: Array.from(flagged), idx, ts: Date.now() }),
      );
      setSavedFlash(true);
      const t = setTimeout(() => setSavedFlash(false), 800);
      return () => clearTimeout(t);
    } catch { /* ignore */ }
  }, [answers, flagged, idx, sessionId, loading]);

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

  const goTo = useCallback((i: number) => {
    setDirection(i > idx ? 1 : -1);
    if (questions[idx]) trackTimeSpent(questions[idx].id);
    setIdx(Math.max(0, Math.min(i, questions.length - 1)));
  }, [idx, questions]);

  const toggleFlag = useCallback((qid: string) => {
    setFlagged((p) => {
      const n = new Set(p);
      n.has(qid) ? n.delete(qid) : n.add(qid);
      return n;
    });
  }, []);

  const setAnswer = (qid: string, val: string) => setAnswers((p) => ({ ...p, [qid]: val }));

  const enterFocus = async () => {
    try {
      await containerRef.current?.requestFullscreen();
      setFocusMode(true);
      integrity.log('focus_mode_entered');
    } catch {
      setFocusMode(true); // fallback to CSS-only fullscreen
    }
  };
  const exitFocus = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch { /* ignore */ }
    setFocusMode(false);
  };

  // Sync focus state with browser fullscreen
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setFocusMode(false);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

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

  // Keyboard shortcuts
  useEffect(() => {
    if (loading) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const q = questions[idx];
      if (!q) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); if (idx < questions.length - 1) goTo(idx + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (idx > 0) goTo(idx - 1); }
      else if (e.key.toLowerCase() === 'f') { e.preventDefault(); toggleFlag(q.id); }
      else if (e.key === '?' ) { e.preventDefault(); setShowShortcuts(true); }
      else if (q.question_type === 'multiple_choice' && /^[1-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10) - 1;
        if (q.options[n]) setAnswer(q.id, q.options[n]);
      } else if (q.question_type === 'true_false') {
        if (e.key.toLowerCase() === 't') setAnswer(q.id, 'True');
        else if (e.key.toLowerCase() === 'f') setAnswer(q.id, 'False');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, questions, loading, goTo, toggleFlag]);

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

  const q = questions[idx];
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const lowTime = remaining < 120;
  const veryLow = remaining < 30;
  const timerColor = veryLow
    ? 'bg-destructive text-destructive-foreground animate-pulse'
    : lowTime
      ? 'bg-amber-500 text-white'
      : 'bg-emerald-600 text-white';

  // Focus mode = always-dark exam shell
  const shellClass = focusMode
    ? 'min-h-screen bg-slate-950 text-slate-100'
    : 'min-h-screen bg-muted/30';

  return (
    <div ref={containerRef} className={shellClass}>
      {/* Sticky header */}
      <div className={`sticky top-0 z-20 backdrop-blur border-b ${focusMode ? 'bg-slate-950/95 border-slate-800' : 'bg-background/95'}`}>
        <div className="container mx-auto px-3 sm:px-4 py-2.5 max-w-6xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className={focusMode ? 'border-slate-700 text-slate-200' : ''}>
              Q {idx + 1}/{questions.length}
            </Badge>
            <span className="text-xs text-muted-foreground hidden md:inline">
              {answered} answered
            </span>
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <Save className={`h-3 w-3 transition-opacity ${savedFlash ? 'text-emerald-500 opacity-100' : 'opacity-40'}`} />
              <span className="hidden md:inline">Saved</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
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
            <Button size="sm" variant="ghost" onClick={() => setShowShortcuts(true)} className={`hidden md:inline-flex ${focusMode ? 'text-slate-200 hover:bg-slate-800' : ''}`}>
              <Keyboard className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setConfirmSubmit(true)} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Send className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Submit</span>
            </Button>
          </div>
        </div>
        {/* progress bar */}
        <div className="h-1 bg-muted/40">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(answered / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl grid lg:grid-cols-[1fr_240px] gap-4 lg:gap-6">
        {/* Question card */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={q.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -30 }}
            transition={{ duration: 0.18 }}
          >
            <Card className={focusMode ? 'bg-slate-900 border-slate-800 text-slate-100' : ''}>
              <CardContent className="p-5 md:p-8">
                <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
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

                <h2 className="font-heading text-lg md:text-2xl font-bold leading-relaxed mb-6 whitespace-pre-wrap select-none">
                  {q.question_text}
                </h2>

                {q.question_type === 'multiple_choice' && (
                  <div className="space-y-2.5">
                    {q.options.map((opt, i) => {
                      const selected = answers[q.id] === opt;
                      const base = focusMode
                        ? selected
                          ? 'border-primary bg-primary/20'
                          : 'border-slate-700 hover:border-primary/60 hover:bg-slate-800'
                        : selected
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50';
                      return (
                        <button
                          key={i}
                          onClick={() => setAnswer(q.id, opt)}
                          className={`w-full text-left border-2 rounded-xl p-3.5 md:p-4 transition-all select-none ${base}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center font-bold text-sm ${
                              selected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : focusMode
                                  ? 'border-slate-600 text-slate-400'
                                  : 'border-muted-foreground/30'
                            }`}>
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span className="flex-1">{opt}</span>
                            <kbd className={`hidden md:inline text-[10px] px-1.5 py-0.5 rounded ${focusMode ? 'bg-slate-800 text-slate-400' : 'bg-muted text-muted-foreground'}`}>
                              {i + 1}
                            </kbd>
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
                          className={`border-2 rounded-xl p-6 font-heading font-bold text-lg transition-all ${
                            selected
                              ? 'border-primary bg-primary/15 text-primary'
                              : focusMode
                                ? 'border-slate-700 hover:border-primary/40'
                                : 'border-border hover:border-primary/40'
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
                    className={`w-full border-2 rounded-xl p-4 text-base outline-none focus:border-primary ${
                      focusMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-background'
                    }`}
                  />
                )}

                <div className={`flex items-center justify-between mt-8 pt-6 border-t ${focusMode ? 'border-slate-800' : ''}`}>
                  <Button variant="outline" disabled={idx === 0} onClick={() => goTo(idx - 1)} className={focusMode ? 'bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800' : ''}>
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
          </motion.div>
        </AnimatePresence>

        {/* Question palette */}
        <Card className={`hidden lg:block h-fit sticky top-20 ${focusMode ? 'bg-slate-900 border-slate-800 text-slate-100' : ''}`}>
          <CardContent className="p-4">
            <p className={`text-xs font-semibold uppercase mb-3 ${focusMode ? 'text-slate-400' : 'text-muted-foreground'}`}>Questions</p>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((qq, i) => {
                const isAnswered = answers[qq.id] != null && answers[qq.id] !== '';
                const isFlagged = flagged.has(qq.id);
                const isCurrent = i === idx;
                const cls = isAnswered
                  ? 'bg-primary text-primary-foreground'
                  : focusMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-muted hover:bg-muted-foreground/20';
                return (
                  <button
                    key={qq.id}
                    onClick={() => goTo(i)}
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
            <div className={`mt-4 pt-3 border-t text-[11px] ${focusMode ? 'border-slate-800 text-slate-400' : 'text-muted-foreground'}`}>
              Press <kbd className={`px-1 rounded ${focusMode ? 'bg-slate-800' : 'bg-muted'}`}>?</kbd> for shortcuts
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile bottom action bar */}
      <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t safe-bottom ${focusMode ? 'bg-slate-950/95 border-slate-800' : 'bg-background/95'} backdrop-blur`}>
        <div className="flex items-center justify-between gap-2 p-2">
          <Button variant="outline" size="sm" disabled={idx === 0} onClick={() => goTo(idx - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={flagged.has(q.id) ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleFlag(q.id)}
            className="flex-1"
          >
            <Flag className="h-4 w-4 mr-1" /> {flagged.has(q.id) ? 'Flagged' : 'Flag'}
          </Button>
          {idx < questions.length - 1 ? (
            <Button size="sm" onClick={() => goTo(idx + 1)} className="flex-1">
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={() => setConfirmSubmit(true)} className="bg-emerald-600 hover:bg-emerald-700 flex-1">
              <Send className="h-4 w-4 mr-1" /> Submit
            </Button>
          )}
        </div>
      </div>
      <div className="lg:hidden h-16" />

      {/* Submit confirm */}
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

      {/* Shortcuts modal */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent>
          <DialogHeader><DialogTitle>Keyboard Shortcuts</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            {[
              ['→ / ←', 'Next / Previous question'],
              ['1-9', 'Select option'],
              ['T / F', 'True / False'],
              ['F', 'Flag question'],
              ['?', 'Show this dialog'],
            ].map(([k, d]) => (
              <div key={k} className="flex justify-between border-b pb-1.5">
                <kbd className="px-2 py-0.5 bg-muted rounded font-mono text-xs">{k}</kbd>
                <span className="text-muted-foreground">{d}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PracticeExam;
