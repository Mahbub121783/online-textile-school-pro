import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Clock, CheckCircle2, XCircle, AlertTriangle, GripVertical } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';

const QuizPlayer = () => {
  const { quizId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [qTimeLeft, setQTimeLeft] = useState<number | null>(null);
  const [blurCount, setBlurCount] = useState(0);
  const startTime = useRef(Date.now());
  const submitRef = useRef(false);

  const { data: quiz } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: async () => {
      const { data } = await supabase.from('quizzes').select('*').eq('id', quizId!).single();
      return data;
    },
    enabled: !!quizId,
  });

  const { data: rawQuestions = [] } = useQuery({
    queryKey: ['quiz-questions', quizId],
    queryFn: async () => {
      const { data } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quizId!).order('sort_order');
      return data ?? [];
    },
    enabled: !!quizId,
  });

  const questions = useMemo(() => {
    let qs = [...rawQuestions];
    if ((quiz as any)?.randomize_questions) {
      const instructions = qs.filter((q: any) => q.is_instruction);
      const nonInstr = qs.filter((q: any) => !q.is_instruction);
      for (let i = nonInstr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nonInstr[i], nonInstr[j]] = [nonInstr[j], nonInstr[i]];
      }
      qs = [...instructions, ...nonInstr];
    }
    if ((quiz as any)?.randomize_options) {
      qs = qs.map((q: any) => {
        if (q.question_type === 'multiple_choice' || q.question_type === 'checkbox') {
          const opts = Array.isArray(q.options) ? [...q.options] : [];
          for (let i = opts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [opts[i], opts[j]] = [opts[j], opts[i]];
          }
          return { ...q, options: opts };
        }
        return q;
      });
    }
    return qs;
  }, [rawQuestions, quiz]);

  const { data: previousAttempts = [] } = useQuery({
    queryKey: ['quiz-attempts', quizId, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('quiz_attempts').select('*').eq('quiz_id', quizId!).eq('user_id', user!.id).order('started_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!quizId && !!user,
  });

  // Session cache: restore
  useEffect(() => {
    if (!quizId || !user) return;
    const key = `quiz_session_${quizId}_${user.id}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setAnswers(parsed.answers || {});
        setCurrentQ(parsed.currentQ || 0);
      } catch {}
    }
  }, [quizId, user]);

  // Session cache: save
  useEffect(() => {
    if (!quizId || !user || submitted) return;
    const key = `quiz_session_${quizId}_${user.id}`;
    localStorage.setItem(key, JSON.stringify({ answers, currentQ }));
  }, [answers, currentQ, quizId, user, submitted]);

  // Global timer
  useEffect(() => {
    if (quiz?.time_limit_minutes && !submitted && timeLeft === null && (quiz as any)?.timer_mode !== 'per_question') {
      setTimeLeft(quiz.time_limit_minutes * 60);
    }
  }, [quiz, submitted, timeLeft]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || submitted) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev !== null && prev <= 1) { handleSubmit(); return 0; }
        return prev !== null ? prev - 1 : null;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted]);

  // Per-question timer
  useEffect(() => {
    if ((quiz as any)?.timer_mode !== 'per_question' || submitted) return;
    const q = questions[currentQ];
    if (q?.timer_seconds) setQTimeLeft(q.timer_seconds);
    else setQTimeLeft(null);
  }, [currentQ, quiz, questions, submitted]);

  useEffect(() => {
    if (qTimeLeft === null || qTimeLeft <= 0 || submitted) return;
    const timer = setInterval(() => {
      setQTimeLeft(prev => {
        if (prev !== null && prev <= 1) {
          if (currentQ < questions.length - 1) setCurrentQ(p => p + 1);
          else handleSubmit();
          return 0;
        }
        return prev !== null ? prev - 1 : null;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [qTimeLeft, submitted]);

  // Anti-cheat: visibility change
  useEffect(() => {
    if (!(quiz as any)?.anti_cheat_enabled || submitted) return;
    const handler = () => {
      if (document.hidden) {
        setBlurCount(prev => {
          const next = prev + 1;
          if (next === 1) {
            toast({ title: '⚠️ Warning', description: 'Tab switch detected. Next switch will auto-submit your quiz.' });
          }
          if (next >= 2 && (quiz as any)?.auto_submit_on_blur) {
            handleSubmit();
          }
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [quiz, submitted]);

  const submitQuiz = useMutation({
    mutationFn: async () => {
      if (submitRef.current) return null;
      submitRef.current = true;
      const timeSpent = Math.round((Date.now() - startTime.current) / 1000);

      // Scoring is authoritative server-side (see backend/src/functions/submitQuizAttempt.js)
      // -- the client only submits raw answers, never a computed score, so a
      // student can no longer fabricate a passing result via devtools/curl.
      const { data, error } = await supabase.functions.invoke('submit-quiz-attempt', {
        body: { quiz_id: quizId, answers, time_spent_seconds: timeSpent },
      });
      if (error) throw new Error(error.message || 'Failed to submit quiz');
      if (data?.error) throw new Error(data.error);
      localStorage.removeItem(`quiz_session_${quizId}_${user!.id}`);
      return data;
    },
    onSuccess: (data) => {
      if (!data) return;
      setResult(data);
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ['quiz-attempts'] });
      toast({ title: data.passed ? '🎉 Quiz Passed!' : 'Quiz Completed', description: `Score: ${data.score}/${data.total_points} (${data.percentage}%)` });
    },
    onError: (e: any) => {
      submitRef.current = false;
      toast({ title: 'Could not submit quiz', description: e.message, variant: 'destructive' });
    },
  });

  const handleSubmit = useCallback(() => {
    if (!submitRef.current && !submitted) submitQuiz.mutate();
  }, [submitted]);

  const attemptsUsed = previousAttempts.filter((a: any) => a.completed_at).length;
  const canAttempt = !quiz?.max_attempts || attemptsUsed < quiz.max_attempts;
  const bestAttempt = previousAttempts.reduce((best: any, a: any) => (!best || (a.percentage || 0) > (best.percentage || 0) ? a : best), null);

  const q = questions[currentQ];
  const options: string[] = q?.options ? (Array.isArray(q.options) ? q.options : JSON.parse(q.options as string)) : [];
  const seqItems: string[] = q?.sequence_items ? (Array.isArray(q.sequence_items) ? q.sequence_items.map(String) : []) : [];

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // Sequence drag state
  const [dragSeqIdx, setDragSeqIdx] = useState<number | null>(null);
  const getUserSeqOrder = (): string[] => {
    const stored = answers[q?.id];
    if (stored) return stored.split('|||');
    return [...seqItems].sort(() => Math.random() - 0.5);
  };
  const [seqOrder, setSeqOrder] = useState<string[]>([]);
  useEffect(() => {
    if (q?.question_type === 'sequence' && seqItems.length > 0) {
      const stored = answers[q.id];
      if (stored) setSeqOrder(stored.split('|||'));
      else {
        // Only shuffle for DISPLAY -- don't write to `answers` yet, or a
        // student who never touches this question still gets an "answer"
        // recorded (and can be negative-marked for it if the question has
        // negative_marks set).
        setSeqOrder([...seqItems].sort(() => Math.random() - 0.5));
      }
    }
  }, [currentQ, q?.id]);

  const handleSeqDrop = (targetIdx: number) => {
    if (dragSeqIdx === null || dragSeqIdx === targetIdx) return;
    const arr = [...seqOrder];
    const [moved] = arr.splice(dragSeqIdx, 1);
    arr.splice(targetIdx, 0, moved);
    setSeqOrder(arr);
    setAnswers(prev => ({ ...prev, [q.id]: arr.join('|||') }));
    setDragSeqIdx(null);
  };

  // Checkbox answers
  const toggleCheckbox = (opt: string) => {
    const current = answers[q.id] ? answers[q.id].split(',') : [];
    const updated = current.includes(opt) ? current.filter(c => c !== opt) : [...current, opt];
    setAnswers(prev => ({ ...prev, [q.id]: updated.join(',') }));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <UtilityBar /><Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="container py-6 max-w-3xl">
          <Button variant="ghost" className="mb-4" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>

          <div className="bg-card border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="font-heading text-xl font-bold">{quiz?.title}</h1>
                {quiz?.description && <p className="text-sm text-muted-foreground mt-1">{quiz.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                {(quiz as any)?.anti_cheat_enabled && blurCount > 0 && (
                  <Badge variant="destructive" className="text-xs">⚠ {blurCount} tab switch</Badge>
                )}
                {qTimeLeft !== null && !submitted && (
                  <Badge variant="outline" className="gap-1 text-base"><Clock className="h-4 w-4" /> {formatTime(qTimeLeft)}</Badge>
                )}
                {timeLeft !== null && !submitted && (
                  <Badge variant="outline" className="gap-1 text-base"><Clock className="h-4 w-4" /> {formatTime(timeLeft)}</Badge>
                )}
              </div>
            </div>

            {attemptsUsed > 0 && !submitted && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm">
                <p>Attempts: {attemptsUsed}/{quiz?.max_attempts || '∞'} · Best: {bestAttempt?.percentage || 0}%</p>
              </div>
            )}

            {submitted && result ? (
              <ResultsView result={result} questions={questions} answers={answers} canAttempt={canAttempt} quiz={quiz}
                onRetry={() => { setSubmitted(false); setResult(null); setAnswers({}); setCurrentQ(0); setTimeLeft(null); submitRef.current = false; startTime.current = Date.now(); }}
                onBack={() => navigate(-1)} />
            ) : questions.length > 0 ? (
              <div className="space-y-6">
                <Progress value={((currentQ + 1) / questions.length) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">Question {currentQ + 1} of {questions.length}</p>

                <div className="min-h-[200px]">
                  {q?.is_instruction ? (
                    <div className="p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
                      <p className="text-xs font-medium text-primary mb-2">📋 Instruction</p>
                      <p className="text-sm whitespace-pre-wrap">{q.question_text}</p>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-medium text-lg mb-4">
                        <span className="text-primary mr-2">Q{currentQ + 1}.</span>{q?.question_text}
                      </h3>
                      {q?.image_url && <img src={q.image_url} alt="Question" className="max-h-48 rounded-lg mb-4 object-contain" />}

                      {q?.question_type === 'true_false' && (
                        <RadioGroup value={answers[q.id] || ''} onValueChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}>
                          {['True', 'False'].map(opt => (
                            <div key={opt} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                              <RadioGroupItem value={opt} id={opt} /><Label htmlFor={opt} className="cursor-pointer flex-1">{opt}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      )}
                      {q?.question_type === 'multiple_choice' && (
                        <RadioGroup value={answers[q.id] || ''} onValueChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}>
                          {options.map((opt, i) => (
                            <div key={i} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                              <RadioGroupItem value={opt} id={`opt-${i}`} /><Label htmlFor={`opt-${i}`} className="cursor-pointer flex-1">{opt}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      )}
                      {q?.question_type === 'checkbox' && (
                        <div className="space-y-2">
                          {options.map((opt, i) => {
                            const checked = (answers[q.id] || '').split(',').includes(opt);
                            return (
                              <div key={i} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => toggleCheckbox(opt)}>
                                <Checkbox checked={checked} /><span className="text-sm flex-1">{opt}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {q?.question_type === 'short_answer' && (
                        <Input placeholder="Type your answer..." value={answers[q?.id] || ''} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} className="text-base" />
                      )}
                      {q?.question_type === 'sequence' && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Drag items into correct order:</p>
                          {seqOrder.map((item, si) => (
                            <div key={si} draggable onDragStart={() => setDragSeqIdx(si)} onDragOver={e => e.preventDefault()} onDrop={() => handleSeqDrop(si)}
                              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 cursor-grab">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-mono text-muted-foreground w-5">{si + 1}.</span>
                              <span className="text-sm">{item}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <Button variant="outline" disabled={currentQ === 0} onClick={() => setCurrentQ(p => p - 1)}>Previous</Button>
                  {currentQ < questions.length - 1 ? (
                    <Button onClick={() => setCurrentQ(p => p + 1)}>Next</Button>
                  ) : (
                    <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSubmit} disabled={submitQuiz.isPending}>Submit Quiz</Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-3" /><p>No questions found for this quiz.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer /><BottomNav />
    </div>
  );
};

const ResultsView = ({ result, questions, answers, canAttempt, quiz, onRetry, onBack }: any) => (
  <div className="space-y-6">
    <div className={`text-center py-8 rounded-xl ${result.passed ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
      {result.passed ? <CheckCircle2 className="h-16 w-16 mx-auto mb-3 text-green-600" /> : <XCircle className="h-16 w-16 mx-auto mb-3 text-destructive" />}
      <h2 className="font-heading text-2xl font-bold">{result.passed ? 'Congratulations!' : 'Keep Trying!'}</h2>
      <p className="text-4xl font-bold mt-2">{result.percentage}%</p>
      <p className="text-muted-foreground mt-1">{result.score}/{result.total_points} points</p>
    </div>
    <div className="space-y-4">
      <h3 className="font-heading font-bold">Review Answers</h3>
      {questions.filter((q: any) => !q.is_instruction).map((question: any, idx: number) => {
        const userAnswer = answers[question.id] || '';
        // Authoritative correctness comes from the server's per-question
        // scoring result, not a client-side re-derivation -- previously this
        // compared every question type (including sequence, whose
        // correct_answer is stored as the placeholder "N/A") against
        // question.correct_answer, so correctly-scored sequence questions
        // always displayed as wrong.
        const perQ = (result.per_question || []).find((p: any) => p.question_id === question.id);
        const isCorrect = perQ ? perQ.is_correct : userAnswer.trim().toLowerCase() === question.correct_answer?.trim().toLowerCase();
        const correctDisplay = question.question_type === 'sequence'
          ? (Array.isArray(question.sequence_items) ? question.sequence_items.join(' → ') : '')
          : question.correct_answer;
        return (
          <div key={question.id} className={`p-4 rounded-lg border ${isCorrect ? 'border-green-200 bg-green-50/50 dark:bg-green-950/10' : 'border-red-200 bg-red-50/50 dark:bg-red-950/10'}`}>
            <p className="font-medium text-sm mb-2">Q{idx + 1}. {question.question_text}</p>
            <p className="text-sm">Your answer: <span className={isCorrect ? 'text-green-600 font-medium' : 'text-destructive font-medium'}>{userAnswer.replaceAll('|||', ' → ') || '(no answer)'}</span></p>
            {!isCorrect && <p className="text-sm text-green-600 mt-1">Correct: {correctDisplay}</p>}
            {question.explanation && <p className="text-xs text-muted-foreground mt-2 italic">{question.explanation}</p>}
          </div>
        );
      })}
    </div>
    <div className="flex gap-3">
      {canAttempt && !result.passed && <Button onClick={onRetry}>Retry Quiz</Button>}
      <Button variant="outline" onClick={onBack}>Back to Course</Button>
    </div>
  </div>
);

export default QuizPlayer;
