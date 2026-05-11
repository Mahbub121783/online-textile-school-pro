import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Trophy, Clock, RefreshCw, History, ChevronRight, Brain } from 'lucide-react';

const PracticeResult = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['qb-result', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('qb_get_session_result', { _session_id: sessionId! });
      if (error) throw error;
      return data as any;
    },
  });

  if (isLoading) return <div className="container mx-auto py-20 text-center text-muted-foreground animate-pulse">Loading result...</div>;
  if (!data) return <div className="container mx-auto py-20 text-center">Result not available.</div>;

  const session = data.session;
  const subject = data.subject;
  const questions = data.questions || [];
  const correctCount = questions.filter((q: any) => q.is_correct).length;
  const minutes = Math.floor(session.time_taken_seconds / 60);
  const seconds = session.time_taken_seconds % 60;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero result */}
        <Card className={`overflow-hidden border-2 ${session.passed ? 'border-emerald-300 dark:border-emerald-800' : 'border-rose-300 dark:border-rose-800'}`}>
          <CardContent className={`p-8 ${session.passed ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-rose-50 dark:bg-rose-950/30'}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <Badge variant={session.passed ? 'default' : 'destructive'} className="mb-3">
                  {session.passed ? '🎉 Passed' : 'Try again'}
                </Badge>
                <h1 className="font-heading text-3xl font-bold mb-1">
                  {Math.round(Number(session.percentage))}%
                </h1>
                <p className="text-muted-foreground">
                  {correctCount} of {questions.length} correct • {subject?.name} • <span className="capitalize">{session.difficulty}</span>
                </p>
              </div>
              <div className="text-right">
                <Trophy className={`h-16 w-16 ${session.passed ? 'text-emerald-500' : 'text-muted-foreground/30'}`} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="bg-background/60 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold font-heading text-emerald-600">{correctCount}</p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
              <div className="bg-background/60 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold font-heading text-rose-600">{questions.length - correctCount}</p>
                <p className="text-xs text-muted-foreground">Wrong</p>
              </div>
              <div className="bg-background/60 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold font-heading text-primary flex items-center justify-center gap-1">
                  <Clock className="h-5 w-5" /> {minutes}:{String(seconds).padStart(2, '0')}
                </p>
                <p className="text-xs text-muted-foreground">Time taken</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              <Button asChild>
                <Link to={`/practice/${subject?.slug}`}><RefreshCw className="h-4 w-4 mr-1" /> Try Again</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/practice/history"><History className="h-4 w-4 mr-1" /> My History</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/practice"><Brain className="h-4 w-4 mr-1" /> All Subjects</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Answer review */}
        <h2 className="font-heading text-2xl font-bold mt-10 mb-4">Answer Review</h2>
        <div className="space-y-3">
          {questions.map((q: any, i: number) => {
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
      </div>
    </div>
  );
};

export default PracticeResult;
