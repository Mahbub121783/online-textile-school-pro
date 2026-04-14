import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GraduationCap, BookOpen, Download, Award, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useState } from 'react';
import { toast } from 'sonner';

const InstructorGradebook = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [gradeDialog, setGradeDialog] = useState<{ open: boolean; userId: string; name: string }>({ open: false, userId: '', name: '' });
  const [gradeForm, setGradeForm] = useState({ letter_grade: '', grade_point: '', credits: '3', semester: '', notes: '' });

  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ['instructor-courses-list', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').eq('instructor_id', user!.id).order('title');
      return data ?? [];
    },
  });

  const courseId = selectedCourse || courses[0]?.id;

  const { data: enrollments = [], isLoading: loadingGrades } = useQuery({
    queryKey: ['instructor-gradebook', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await supabase
        .from('enrollments')
        .select('*, user_profiles!enrollments_user_id_fkey(full_name, avatar_url)')
        .eq('course_id', courseId!);
      return data ?? [];
    },
  });

  const { data: quizAttempts = [] } = useQuery({
    queryKey: ['instructor-quiz-attempts', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data: quizzes } = await supabase.from('quizzes').select('id').eq('course_id', courseId!);
      if (!quizzes?.length) return [];
      const { data } = await supabase.from('quiz_attempts').select('*').in('quiz_id', quizzes.map(q => q.id));
      return data ?? [];
    },
  });

  const { data: assignSubs = [] } = useQuery({
    queryKey: ['instructor-assign-subs', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data: assigns } = await supabase.from('assignments').select('id').eq('course_id', courseId!);
      if (!assigns?.length) return [];
      const { data } = await supabase.from('assignment_submissions').select('*').in('assignment_id', assigns.map(a => a.id));
      return data ?? [];
    },
  });

  // Attendance data for this course's live classes
  const { data: attendanceData = [] } = useQuery({
    queryKey: ['instructor-attendance-rates', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data: liveClasses } = await supabase.from('live_classes').select('id').eq('course_id', courseId!);
      if (!liveClasses?.length) return [];
      const lcIds = liveClasses.map(lc => lc.id);
      const { data } = await supabase.from('attendance_records').select('user_id, status').in('live_class_id', lcIds);
      return data ?? [];
    },
  });

  // Grade configs for dropdown
  const { data: gradeConfigs = [] } = useQuery({
    queryKey: ['grade-configs'],
    queryFn: async () => {
      const { data } = await supabase.from('grade_configs').select('*').eq('is_active', true).order('sort_order');
      return data ?? [];
    },
  });

  // Existing grades for this course
  const { data: existingGrades = [] } = useQuery({
    queryKey: ['existing-student-grades', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await supabase.from('student_grades' as any).select('*').eq('course_id', courseId!);
      return (data || []) as any[];
    },
  });

  const assignGradeMutation = useMutation({
    mutationFn: async () => {
      const existing = existingGrades.find((g: any) => g.user_id === gradeDialog.userId);
      const payload = {
        user_id: gradeDialog.userId,
        course_id: courseId,
        letter_grade: gradeForm.letter_grade,
        grade_point: parseFloat(gradeForm.grade_point),
        credits: parseFloat(gradeForm.credits),
        semester: gradeForm.semester || null,
        notes: gradeForm.notes || null,
      };
      if (existing) {
        const { error } = await supabase.from('student_grades' as any).update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('student_grades' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['existing-student-grades', courseId] });
      toast.success('Grade assigned successfully');
      setGradeDialog({ open: false, userId: '', name: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openGradeDialog = (userId: string, name: string) => {
    const existing = existingGrades.find((g: any) => g.user_id === userId);
    if (existing) {
      setGradeForm({
        letter_grade: existing.letter_grade || '',
        grade_point: existing.grade_point?.toString() || '',
        credits: existing.credits?.toString() || '3',
        semester: existing.semester || '',
        notes: existing.notes || '',
      });
    } else {
      setGradeForm({ letter_grade: '', grade_point: '', credits: '3', semester: '', notes: '' });
    }
    setGradeDialog({ open: true, userId, name });
  };

  const handleGradeSelect = (letterGrade: string) => {
    const config = gradeConfigs.find((g: any) => g.letter_grade === letterGrade);
    setGradeForm(prev => ({
      ...prev,
      letter_grade: letterGrade,
      grade_point: config ? config.grade_point.toString() : prev.grade_point,
    }));
  };

  if (loadingCourses) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-2xl font-bold">Gradebook</h2>
          {enrollments.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              const headers = ['Student', 'Progress', 'Attendance', 'Quiz Avg', 'Assignments Graded', 'Grade', 'Status'];
              const rows = enrollments.map((enr: any) => {
                const sq = quizAttempts.filter((a: any) => a.user_id === enr.user_id && a.completed_at);
                const avg = sq.length > 0 ? Math.round(sq.reduce((s: number, a: any) => s + (a.percentage || 0), 0) / sq.length) : '';
                const sa = assignSubs.filter((s: any) => s.user_id === enr.user_id);
                const graded = sa.filter((s: any) => s.status === 'graded');
                const eg = existingGrades.find((g: any) => g.user_id === enr.user_id);
                const ua = attendanceData.filter((a: any) => a.user_id === enr.user_id);
                const aRate = ua.length > 0 ? Math.round((ua.filter((a: any) => a.status === 'present' || a.status === 'late').length / ua.length) * 100) + '%' : 'N/A';
                return [enr.user_profiles?.full_name || 'Student', `${enr.progress_pct || 0}%`, avg ? `${avg}%` : 'N/A', `${graded.length}/${sa.length}`, eg ? `${eg.letter_grade} (${eg.grade_point})` : 'N/A', enr.completed_at ? 'Completed' : 'In Progress'];
              });
              const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'gradebook.csv'; a.click();
              URL.revokeObjectURL(url);
            }}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          )}
        </div>
        <Select value={courseId || ''} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select course" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!courseId ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted" />
          <p>No courses found. Create a course first.</p>
        </div>
      ) : loadingGrades ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : enrollments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <GraduationCap className="h-16 w-16 mx-auto mb-4 text-muted" />
          <p>No students enrolled in this course yet.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                   <th className="text-left p-3 font-medium">Student</th>
                   <th className="text-center p-3 font-medium">Progress</th>
                   <th className="text-center p-3 font-medium">Attendance</th>
                   <th className="text-center p-3 font-medium">Quiz Avg</th>
                   <th className="text-center p-3 font-medium">Assignments</th>
                   <th className="text-center p-3 font-medium">Grade</th>
                   <th className="text-center p-3 font-medium">Status</th>
                   <th className="text-center p-3 font-medium">Actions</th>
                 </tr>
              </thead>
              <tbody>
                {enrollments.map((enr: any) => {
                  const studentQuizzes = quizAttempts.filter((a: any) => a.user_id === enr.user_id && a.completed_at);
                  const avgQuiz = studentQuizzes.length > 0
                    ? Math.round(studentQuizzes.reduce((s: number, a: any) => s + (a.percentage || 0), 0) / studentQuizzes.length)
                    : null;
                  const studentAssigns = assignSubs.filter((s: any) => s.user_id === enr.user_id);
                  const gradedAssigns = studentAssigns.filter((s: any) => s.status === 'graded');
                  const eg = existingGrades.find((g: any) => g.user_id === enr.user_id);
                  const userAttendance = attendanceData.filter((a: any) => a.user_id === enr.user_id);
                  const totalClasses = userAttendance.length;
                  const presentClasses = userAttendance.filter((a: any) => a.status === 'present' || a.status === 'late').length;
                  const attendanceRate = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : null;

                  return (
                    <tr key={enr.id} className="border-b hover:bg-muted/20">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                            {enr.user_profiles?.full_name?.[0]?.toUpperCase() || 'S'}
                          </div>
                          <span className="font-medium">{enr.user_profiles?.full_name || 'Student'}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${enr.progress_pct || 0}%` }} />
                          </div>
                          <span className="text-xs">{enr.progress_pct || 0}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {attendanceRate !== null ? (
                          <span className={`font-medium text-sm flex items-center justify-center gap-1 ${attendanceRate < 75 ? 'text-destructive' : ''}`}>
                            {attendanceRate < 75 && <AlertTriangle className="h-3 w-3" />}
                            {attendanceRate}%
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3 text-center">
                        {avgQuiz !== null ? <span className="font-medium">{avgQuiz}%</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-xs">{gradedAssigns.length}/{studentAssigns.length} graded</span>
                      </td>
                      <td className="p-3 text-center">
                        {eg ? (
                          <Badge variant="outline" className="text-xs">{eg.letter_grade} ({eg.grade_point})</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={enr.completed_at ? 'default' : 'secondary'} className="text-xs">
                          {enr.completed_at ? 'Completed' : 'In Progress'}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => openGradeDialog(enr.user_id, enr.user_profiles?.full_name || 'Student')}
                        >
                          <Award className="h-3 w-3" />
                          {eg ? 'Edit' : 'Assign'} Grade
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grade Assignment Dialog */}
      <Dialog open={gradeDialog.open} onOpenChange={(open) => setGradeDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Grade — {gradeDialog.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Letter Grade *</Label>
              <Select value={gradeForm.letter_grade} onValueChange={handleGradeSelect}>
                <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                <SelectContent>
                  {gradeConfigs.map((gc: any) => (
                    <SelectItem key={gc.id} value={gc.letter_grade}>
                      {gc.letter_grade} ({gc.grade_point} pts — {gc.min_pct}%-{gc.max_pct}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Grade Point</Label>
                <Input value={gradeForm.grade_point} onChange={e => setGradeForm(p => ({ ...p, grade_point: e.target.value }))} type="number" step="0.01" />
              </div>
              <div>
                <Label>Credits</Label>
                <Input value={gradeForm.credits} onChange={e => setGradeForm(p => ({ ...p, credits: e.target.value }))} type="number" step="0.5" />
              </div>
            </div>
            <div>
              <Label>Semester</Label>
              <Input value={gradeForm.semester} onChange={e => setGradeForm(p => ({ ...p, semester: e.target.value }))} placeholder="e.g. Fall 2025" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={gradeForm.notes} onChange={e => setGradeForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradeDialog(prev => ({ ...prev, open: false }))}>Cancel</Button>
            <Button
              onClick={() => assignGradeMutation.mutate()}
              disabled={!gradeForm.letter_grade || !gradeForm.grade_point || assignGradeMutation.isPending}
            >
              {assignGradeMutation.isPending ? 'Saving...' : 'Save Grade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstructorGradebook;
