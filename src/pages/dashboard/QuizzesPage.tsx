import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useLessonProgress } from '@/hooks/useLessonProgress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { FileQuestion, CheckCircle2, XCircle, Clock, Lock, BookOpen, Timer } from 'lucide-react';
import { differenceInSeconds, differenceInDays, differenceInHours, differenceInMinutes, isBefore } from 'date-fns';
import { useEffect, useState } from 'react';

const formatCountdown = (targetDate: Date) => {
  const now = new Date();
  if (isBefore(targetDate, now)) return null;
  const days = differenceInDays(targetDate, now);
  const hours = differenceInHours(targetDate, now) % 24;
  const mins = differenceInMinutes(targetDate, now) % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const LiveCountdown = ({ target }: { target: Date }) => {
  const [text, setText] = useState(() => formatCountdown(target));
  useEffect(() => {
    const iv = setInterval(() => setText(formatCountdown(target)), 30_000);
    return () => clearInterval(iv);
  }, [target]);
  if (!text) return null;
  return (
    <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
      <Timer className="h-3 w-3" /> Unlocks in {text}
    </span>
  );
};

const QuizzesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isLessonCompleted, isLoading: progressLoading } = useLessonProgress();

  const { data: enrollments = [] } = useQuery({
    queryKey: ['my-enrollments-ids', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('enrollments').select('course_id').eq('user_id', user!.id);
      return data ?? [];
    },
  });
  const courseIds = enrollments.map((e: any) => e.course_id);

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ['my-quizzes', courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('quizzes')
        .select('*, courses(title, thumbnail_url)')
        .eq('is_published', true)
        .in('course_id', courseIds)
        .order('sort_order');
      return data ?? [];
    },
  });

  // Fetch linked lessons for drip/unlock checking
  const lessonIds = [...new Set(quizzes.map((q: any) => q.lesson_id).filter(Boolean))];
  const { data: linkedLessons = [] } = useQuery({
    queryKey: ['quiz-linked-lessons', lessonIds],
    enabled: lessonIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('lessons').select('id, title, scheduled_unlock_at').in('id', lessonIds);
      return data ?? [];
    },
  });
  const lessonMap = new Map(linkedLessons.map((l: any) => [l.id, l]));

  const { data: attempts = [] } = useQuery({
    queryKey: ['all-quiz-attempts', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('quiz_attempts')
        .select('quiz_id, percentage, passed, completed_at')
        .eq('user_id', user!.id)
        .order('percentage', { ascending: false });
      return data ?? [];
    },
  });

  const bestAttemptMap = new Map<string, any>();
  attempts.forEach((a: any) => {
    if (!bestAttemptMap.has(a.quiz_id) || (a.percentage || 0) > (bestAttemptMap.get(a.quiz_id)?.percentage || 0)) {
      bestAttemptMap.set(a.quiz_id, a);
    }
  });

  // Group by course
  const courseGroups = new Map<string, { title: string; thumbnail: string | null; quizzes: any[] }>();
  quizzes.forEach((q: any) => {
    const cid = q.course_id;
    if (!courseGroups.has(cid)) {
      courseGroups.set(cid, { title: q.courses?.title || 'Unknown Course', thumbnail: q.courses?.thumbnail_url, quizzes: [] });
    }
    courseGroups.get(cid)!.quizzes.push(q);
  });

  const getQuizLockState = (quiz: any): { locked: boolean; reason: string; unlockDate?: Date } => {
    if (!quiz.lesson_id) return { locked: false, reason: '' };
    const lesson = lessonMap.get(quiz.lesson_id);
    // Drip content check
    if (lesson?.scheduled_unlock_at) {
      const unlockDate = new Date(lesson.scheduled_unlock_at);
      if (isBefore(new Date(), unlockDate)) {
        return { locked: true, reason: 'Lesson not unlocked yet', unlockDate };
      }
    }
    // Lesson completion check
    if (!isLessonCompleted(quiz.lesson_id)) {
      return { locked: true, reason: `Complete "${lesson?.title || 'linked lesson'}" first` };
    }
    return { locked: false, reason: '' };
  };

  if (isLoading || progressLoading) {
    return <div className="animate-pulse text-muted-foreground py-12 text-center">Loading quizzes...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">Quizzes</h2>

      {quizzes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileQuestion className="h-16 w-16 mx-auto mb-4 text-muted" />
          <h3 className="font-heading font-bold text-lg mb-2">No quizzes available</h3>
          <p>Quizzes from your enrolled courses will appear here.</p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={[...courseGroups.keys()]} className="space-y-3">
          {[...courseGroups.entries()].map(([courseId, group]) => {
            const completedCount = group.quizzes.filter((q: any) => bestAttemptMap.get(q.id)?.passed).length;
            return (
              <AccordionItem key={courseId} value={courseId} className="border rounded-xl bg-card overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <BookOpen className="h-5 w-5 text-primary shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="font-heading font-bold text-sm truncate">{group.title}</p>
                      <p className="text-xs text-muted-foreground">{completedCount}/{group.quizzes.length} passed</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {group.quizzes.map((quiz: any) => {
                      const best = bestAttemptMap.get(quiz.id);
                      const lock = getQuizLockState(quiz);
                      return (
                        <Card key={quiz.id} className={`transition-all ${lock.locked ? 'opacity-60' : 'hover:shadow-md'}`}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{quiz.title}</p>
                                {quiz.time_limit_minutes && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Clock className="h-3 w-3" /> {quiz.time_limit_minutes} min
                                  </p>
                                )}
                              </div>
                              {best ? (
                                <Badge variant={best.passed ? 'default' : 'destructive'} className="shrink-0 gap-1">
                                  {best.passed ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                  {best.percentage}%
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="shrink-0">New</Badge>
                              )}
                            </div>

                            {best && (
                              <Progress value={best.percentage} className="h-1.5" />
                            )}

                            {lock.locked ? (
                              <div className="space-y-2">
                                {lock.unlockDate && <LiveCountdown target={lock.unlockDate} />}
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Lock className="h-3 w-3" /> {lock.reason}
                                </div>
                                <Button size="sm" disabled className="w-full gap-1">
                                  <Lock className="h-3.5 w-3.5" /> Locked
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Pass: {quiz.pass_percentage}%
                                </span>
                                <Button size="sm" onClick={() => navigate(`/quiz/${quiz.id}`)}>
                                  {best ? 'Retry' : 'Start'}
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
};

export default QuizzesPage;
