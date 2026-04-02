import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GraduationCap, BookOpen, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const InstructorGradebook = () => {
  const { user } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState<string>('');

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

  // Quiz attempts for this course
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

  // Assignment submissions
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

  if (loadingCourses) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="font-heading text-2xl font-bold">Gradebook</h2>
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
                  <th className="text-center p-3 font-medium">Quiz Avg</th>
                  <th className="text-center p-3 font-medium">Assignments</th>
                  <th className="text-center p-3 font-medium">Status</th>
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
                        {avgQuiz !== null ? <span className="font-medium">{avgQuiz}%</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-xs">{gradedAssigns.length}/{studentAssigns.length} graded</span>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={enr.completed_at ? 'default' : 'secondary'} className="text-xs">
                          {enr.completed_at ? 'Completed' : 'In Progress'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstructorGradebook;
