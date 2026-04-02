import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { GraduationCap, Plus, MoreHorizontal, Download, Upload } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { toast } from 'sonner';

const InstructorStudents = () => {
  const { user } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [enrollModal, setEnrollModal] = useState(false);
  const [enrollEmail, setEnrollEmail] = useState('');
  const [activeTab, setActiveTab] = useState('students');
  const [gradingSheet, setGradingSheet] = useState<{ open: boolean; submission?: any }>({ open: false });
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState('');

  const { data: courses = [] } = useQuery({
    queryKey: ['instructor-courses-list', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').eq('instructor_id', user!.id);
      return data ?? [];
    },
  });

  const courseIds = selectedCourse === 'all' ? courses.map((c: any) => c.id) : [selectedCourse];

  const { data: enrollments = [], isLoading, refetch: refetchEnrollments } = useQuery({
    queryKey: ['instructor-students', courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('enrollments')
        .select('*, user_profiles(full_name, roll_id, phone, avatar_url), courses(title)')
        .in('course_id', courseIds)
        .order('enrolled_at', { ascending: false });
      return data ?? [];
    },
  });

  // Gradebook data
  const { data: gradebookData = { quizAttempts: [], submissions: [], quizzes: [], assignments: [] } } = useQuery({
    queryKey: ['gradebook-data', courseIds],
    enabled: courseIds.length > 0 && activeTab === 'gradebook',
    queryFn: async () => {
      const { data: quizzes } = await supabase.from('quizzes').select('id, title, course_id').in('course_id', courseIds);
      const { data: assignments } = await supabase.from('assignments').select('id, title, course_id, max_score').in('course_id', courseIds);
      const quizIds = (quizzes ?? []).map((q: any) => q.id);
      const assignmentIds = (assignments ?? []).map((a: any) => a.id);
      let quizAttempts: any[] = [];
      let submissions: any[] = [];
      if (quizIds.length > 0) {
        const { data } = await supabase.from('quiz_attempts').select('*, user_profiles:user_id(full_name)').in('quiz_id', quizIds);
        quizAttempts = data ?? [];
      }
      if (assignmentIds.length > 0) {
        const { data } = await supabase.from('assignment_submissions').select('*, user_profiles:user_id(full_name)').in('assignment_id', assignmentIds);
        submissions = data ?? [];
      }
      return { quizAttempts, submissions, quizzes: quizzes ?? [], assignments: assignments ?? [] };
    },
  });

  const handleEnroll = async () => {
    if (!enrollEmail.trim() || selectedCourse === 'all') { toast.error('Select a course and enter email'); return; }
    const { data: profile } = await supabase.from('user_profiles').select('id, phone').eq('phone', enrollEmail).single();
    if (!profile) { toast.error('User not found'); return; }
    const { error } = await supabase.from('enrollments').insert({ user_id: profile.id, course_id: selectedCourse });
    if (error) { toast.error(error.message); } else { toast.success('Student enrolled!'); refetchEnrollments(); setEnrollModal(false); setEnrollEmail(''); }
  };

  const removeAccess = async (enrollmentId: string) => {
    // We can't delete enrollments (no DELETE RLS), so we could set progress to -1 as a flag
    toast.info('Contact admin to remove enrollment');
  };

  const resetProgress = async (enrollmentId: string) => {
    await supabase.from('enrollments').update({ progress_pct: 0, completed_at: null }).eq('id', enrollmentId);
    refetchEnrollments();
    toast.success('Progress reset');
  };

  const gradeSubmission = async () => {
    if (!gradingSheet.submission) return;
    const { error } = await supabase.from('assignment_submissions').update({
      score: Number(score), feedback, status: 'graded', graded_at: new Date().toISOString(),
    }).eq('id', gradingSheet.submission.id);
    if (!error) { toast.success('Graded!'); setGradingSheet({ open: false }); }
  };

  // Build gradebook matrix
  const studentIds = [...new Set(enrollments.map((e: any) => e.user_id))];
  const allAssessments = [
    ...gradebookData.quizzes.map((q: any) => ({ ...q, type: 'quiz' })),
    ...gradebookData.assignments.map((a: any) => ({ ...a, type: 'assignment' })),
  ];

  if (isLoading) return <div className="animate-pulse py-12 text-center text-muted-foreground">Loading students...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading text-2xl font-bold">Students</h2>
        <div className="flex items-center gap-3">
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filter by course" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.csv';
            input.onchange = async (e: any) => {
              const file = e.target.files?.[0];
              if (!file || selectedCourse === 'all') { toast.error('Select a specific course first'); return; }
              const text = await file.text();
              const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
              const emails = lines.slice(1); // skip header
              let enrolled = 0, notFound = 0, alreadyEnrolled = 0;
              for (const identifier of emails) {
                const clean = identifier.replace(/"/g, '').trim();
                if (!clean) continue;
                const { data: profile } = await supabase.from('user_profiles').select('id').or(`phone.eq.${clean}`).single();
                if (!profile) { notFound++; continue; }
                const { error } = await supabase.from('enrollments').insert({ user_id: profile.id, course_id: selectedCourse });
                if (error) { alreadyEnrolled++; } else { enrolled++; }
              }
              toast.success(`Enrolled: ${enrolled}, Not found: ${notFound}, Already enrolled: ${alreadyEnrolled}`);
              refetchEnrollments();
            };
            input.click();
          }}>
            <Upload className="h-4 w-4" /> Bulk CSV
          </Button>
          <Button className="bg-accent hover:bg-accent-hover text-accent-foreground gap-1.5" onClick={() => setEnrollModal(true)}>
            <Plus className="h-4 w-4" /> Enroll Student
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="students">Enrollment Manager</TabsTrigger>
          <TabsTrigger value="gradebook">Gradebook</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4">
          {enrollments.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <GraduationCap className="h-16 w-16 mx-auto mb-4 text-muted" />
              <p>No students enrolled yet.</p>
            </div>
          ) : (
            <div className="bg-card border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead className="hidden md:table-cell">Enrolled</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                            {e.user_profiles?.full_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{e.user_profiles?.full_name || 'Student'}</p>
                            <p className="text-xs text-muted-foreground">{e.user_profiles?.roll_id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{e.courses?.title}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {format(new Date(e.enrolled_at), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${e.progress_pct || 0}%` }} />
                          </div>
                          <span className="text-xs font-medium">{e.progress_pct || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={e.completed_at ? 'default' : 'secondary'}>
                          {e.completed_at ? 'Completed' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => resetProgress(e.id)}>Reset Progress</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => removeAccess(e.id)}>Remove Access</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="gradebook" className="mt-4">
          {allAssessments.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No quizzes or assignments found for selected courses.</p>
          ) : (
            <div className="bg-card border rounded-xl overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10">Student</TableHead>
                    {allAssessments.map((a) => (
                      <TableHead key={a.id} className="text-center min-w-[100px]">
                        <div className="text-xs">{a.title}</div>
                        <div className="text-[10px] text-muted-foreground">{a.type}</div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentIds.map((uid) => {
                    const enrollment = enrollments.find((e: any) => e.user_id === uid);
                    return (
                      <TableRow key={uid as string}>
                        <TableCell className="sticky left-0 bg-card z-10 font-medium text-sm">
                          {enrollment?.user_profiles?.full_name || 'Student'}
                        </TableCell>
                        {allAssessments.map((assess) => {
                          if (assess.type === 'quiz') {
                            const attempt = gradebookData.quizAttempts.find((a: any) => a.quiz_id === assess.id && a.user_id === uid);
                            return (
                              <TableCell key={assess.id} className="text-center">
                                {attempt ? (
                                  <Badge variant={attempt.passed ? 'default' : 'destructive'} className="text-xs">
                                    {attempt.percentage}%
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            );
                          } else {
                            const sub = gradebookData.submissions.find((s: any) => s.assignment_id === assess.id && s.user_id === uid);
                            return (
                              <TableCell key={assess.id} className="text-center">
                                {sub ? (
                                  sub.status === 'graded' ? (
                                    <Badge variant="default" className="text-xs">{sub.score}/{assess.max_score}</Badge>
                                  ) : (
                                    <Button variant="outline" size="sm" className="text-xs h-6" onClick={() => { setGradingSheet({ open: true, submission: sub }); setFeedback(sub.feedback || ''); setScore(String(sub.score || '')); }}>
                                      Pending
                                    </Button>
                                  )
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            );
                          }
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Enroll Modal */}
      <Dialog open={enrollModal} onOpenChange={setEnrollModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manually Enroll Student</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={selectedCourse === 'all' ? '' : selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>{courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Student Phone/Email</Label>
              <Input value={enrollEmail} onChange={(e) => setEnrollEmail(e.target.value)} placeholder="Search by phone number" />
            </div>
            <Button className="w-full bg-accent hover:bg-accent-hover text-accent-foreground" onClick={handleEnroll}>Enroll</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grading Sheet */}
      <Sheet open={gradingSheet.open} onOpenChange={(o) => setGradingSheet({ open: o })}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader><SheetTitle>Grade Submission</SheetTitle></SheetHeader>
          {gradingSheet.submission && (
            <div className="space-y-4 mt-4">
              {gradingSheet.submission.file_url && (
                <Button variant="outline" className="gap-2 w-full" onClick={() => window.open(gradingSheet.submission.file_url, '_blank')}>
                  <Download className="h-4 w-4" /> Download Submission
                </Button>
              )}
              {gradingSheet.submission.submission_text && (
                <div className="bg-muted/30 p-4 rounded-lg text-sm max-h-40 overflow-y-auto">
                  {gradingSheet.submission.submission_text}
                </div>
              )}
              <div className="space-y-2">
                <Label>Score</Label>
                <Input type="number" value={score} onChange={(e) => setScore(e.target.value)} placeholder="Enter score" />
              </div>
              <div className="space-y-2">
                <Label>Feedback</Label>
                <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} placeholder="Write feedback for the student..." />
              </div>
              <Button className="w-full bg-accent hover:bg-accent-hover text-accent-foreground" onClick={gradeSubmission}>Submit Grade</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default InstructorStudents;
