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
import { ClipboardList, Upload, CheckCircle2, Clock, AlertCircle, Lock, BookOpen, Timer } from 'lucide-react';
import { addDays, differenceInDays, differenceInHours, format, isBefore, isAfter } from 'date-fns';
import { useEffect, useState } from 'react';

const DeadlineCountdown = ({ deadline }: { deadline: Date }) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(iv);
  }, []);

  const overdue = isAfter(now, deadline);
  const days = Math.abs(differenceInDays(deadline, now));
  const hours = Math.abs(differenceInHours(deadline, now)) % 24;

  if (overdue) {
    return (
      <span className="text-xs text-destructive flex items-center gap-1 font-medium">
        <AlertCircle className="h-3 w-3" /> Overdue by {days > 0 ? `${days}d ` : ''}{hours}h
      </span>
    );
  }
  if (days <= 3) {
    return (
      <span className={`text-xs flex items-center gap-1 font-medium ${days <= 1 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>
        <Timer className="h-3 w-3" /> Due in {days > 0 ? `${days}d ` : ''}{hours}h
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      <Clock className="h-3 w-3" /> Due {format(deadline, 'dd MMM yyyy')}
    </span>
  );
};

const statusConfig: Record<string, { label: string; icon: any; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  submitted: { label: 'Submitted', icon: Clock, variant: 'secondary' },
  graded: { label: 'Graded', icon: CheckCircle2, variant: 'default' },
  returned: { label: 'Returned', icon: AlertCircle, variant: 'destructive' },
  resubmitted: { label: 'Resubmitted', icon: Clock, variant: 'outline' },
};

const AssignmentsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { areSectionLessonsCompleted, isLoading: progressLoading } = useLessonProgress();

  const { data: enrollments = [] } = useQuery({
    queryKey: ['my-enrollments-ids', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('enrollments').select('course_id, enrolled_at').eq('user_id', user!.id);
      return data ?? [];
    },
  });
  const courseIds = enrollments.map((e: any) => e.course_id);
  const enrollmentMap = new Map(enrollments.map((e: any) => [e.course_id, e]));

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['my-assignments', courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('assignments')
        .select('*, courses(title, thumbnail_url)')
        .eq('is_published', true)
        .in('course_id', courseIds)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  // Fetch section lessons for locking
  const sectionIds = [...new Set(assignments.map((a: any) => a.section_id).filter(Boolean))];
  const { data: sectionLessons = [] } = useQuery({
    queryKey: ['section-lessons-for-lock', sectionIds],
    enabled: sectionIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('lessons').select('id, section_id, title').in('section_id', sectionIds);
      return data ?? [];
    },
  });
  const sectionLessonMap = new Map<string, string[]>();
  sectionLessons.forEach((l: any) => {
    if (!sectionLessonMap.has(l.section_id)) sectionLessonMap.set(l.section_id, []);
    sectionLessonMap.get(l.section_id)!.push(l.id);
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['my-submissions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('assignment_submissions').select('*').eq('user_id', user!.id);
      return data ?? [];
    },
  });
  const submissionMap = new Map(submissions.map((s: any) => [s.assignment_id, s]));

  // Group by course
  const courseGroups = new Map<string, { title: string; assignments: any[] }>();
  assignments.forEach((a: any) => {
    const cid = a.course_id;
    if (!courseGroups.has(cid)) {
      courseGroups.set(cid, { title: a.courses?.title || 'Unknown Course', assignments: [] });
    }
    courseGroups.get(cid)!.assignments.push(a);
  });

  const getDeadline = (assignment: any): Date | null => {
    if (!assignment.due_days || !assignment.course_id) return null;
    const enrollment = enrollmentMap.get(assignment.course_id);
    if (!enrollment?.enrolled_at) return null;
    return addDays(new Date(enrollment.enrolled_at), assignment.due_days);
  };

  const getLockState = (assignment: any): { locked: boolean; reason: string } => {
    if (!assignment.section_id) return { locked: false, reason: '' };
    const lessonIds = sectionLessonMap.get(assignment.section_id) || [];
    if (lessonIds.length === 0) return { locked: false, reason: '' };
    if (!areSectionLessonsCompleted(lessonIds)) {
      return { locked: true, reason: 'Complete all section lessons first' };
    }
    return { locked: false, reason: '' };
  };

  if (isLoading || progressLoading) {
    return <div className="animate-pulse text-muted-foreground py-12 text-center">Loading assignments...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">Assignments</h2>

      {assignments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="h-16 w-16 mx-auto mb-4 text-muted" />
          <h3 className="font-heading font-bold text-lg mb-2">No assignments yet</h3>
          <p>Assignments from your enrolled courses will appear here.</p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={[...courseGroups.keys()]} className="space-y-3">
          {[...courseGroups.entries()].map(([courseId, group]) => {
            const submittedCount = group.assignments.filter((a: any) => submissionMap.has(a.id)).length;
            return (
              <AccordionItem key={courseId} value={courseId} className="border rounded-xl bg-card overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <BookOpen className="h-5 w-5 text-primary shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="font-heading font-bold text-sm truncate">{group.title}</p>
                      <p className="text-xs text-muted-foreground">{submittedCount}/{group.assignments.length} submitted</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {group.assignments.map((assignment: any) => {
                      const sub = submissionMap.get(assignment.id);
                      const status = sub ? statusConfig[sub.status] || statusConfig.submitted : null;
                      const lock = getLockState(assignment);
                      const deadline = getDeadline(assignment);

                      return (
                        <Card key={assignment.id} className={`transition-all ${lock.locked ? 'opacity-60' : 'hover:shadow-md'}`}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{assignment.title}</p>
                                {assignment.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{assignment.description}</p>
                                )}
                              </div>
                              {status ? (
                                <Badge variant={status.variant} className="shrink-0 gap-1">
                                  <status.icon className="h-3 w-3" /> {status.label}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="shrink-0">Pending</Badge>
                              )}
                            </div>

                            {sub?.score !== null && sub?.score !== undefined && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Score</span>
                                  <span className="font-medium">{sub.score}/{assignment.max_score}</span>
                                </div>
                                <Progress value={(sub.score / (assignment.max_score || 100)) * 100} className="h-1.5" />
                              </div>
                            )}

                            {deadline && <DeadlineCountdown deadline={deadline} />}

                            {lock.locked ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Lock className="h-3 w-3" /> {lock.reason}
                                </div>
                                <Button size="sm" disabled className="w-full gap-1">
                                  <Lock className="h-3.5 w-3.5" /> Locked
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant={sub ? 'outline' : 'default'}
                                className="w-full"
                                onClick={() => navigate(`/assignment/${assignment.id}`)}
                              >
                                {sub ? 'View Submission' : 'Submit'}
                              </Button>
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

export default AssignmentsPage;
