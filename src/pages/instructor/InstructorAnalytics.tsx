import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BarChart3, TrendingUp, Users, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--muted-foreground))', '#f97316'];

const InstructorAnalytics = () => {
  const { user } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState<string>('');

  const { data: courses = [] } = useQuery({
    queryKey: ['instructor-courses-list', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').eq('instructor_id', user!.id);
      return data ?? [];
    },
  });

  const courseId = selectedCourse || courses[0]?.id;

  // Enrollments
  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['analytics-enrollments', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await supabase.from('enrollments').select('id, user_id, progress_pct, completed_at, enrolled_at').eq('course_id', courseId!);
      return data ?? [];
    },
  });

  // Lessons for this course
  const { data: lessons = [] } = useQuery({
    queryKey: ['analytics-lessons', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data: sections } = await supabase.from('course_sections').select('id').eq('course_id', courseId!);
      if (!sections?.length) return [];
      const { data } = await supabase.from('lessons').select('id, title, sort_order').in('section_id', sections.map(s => s.id)).order('sort_order');
      return data ?? [];
    },
  });

  // Lesson progress
  const { data: lessonProgress = [] } = useQuery({
    queryKey: ['analytics-lesson-progress', courseId, lessons],
    enabled: lessons.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('lesson_progress').select('lesson_id, completed').in('lesson_id', lessons.map(l => l.id)).eq('completed', true);
      return data ?? [];
    },
  });

  // Quiz attempts
  const { data: quizAttempts = [] } = useQuery({
    queryKey: ['analytics-quiz-attempts', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data: quizzes } = await supabase.from('quizzes').select('id').eq('course_id', courseId!);
      if (!quizzes?.length) return [];
      const { data } = await supabase.from('quiz_attempts').select('id, passed, percentage, completed_at').in('quiz_id', quizzes.map(q => q.id));
      return data ?? [];
    },
  });

  // Derived stats
  const totalStudents = enrollments.length;
  const completedStudents = enrollments.filter((e: any) => e.completed_at).length;
  const completionRate = totalStudents > 0 ? Math.round((completedStudents / totalStudents) * 100) : 0;
  const avgProgress = totalStudents > 0 ? Math.round(enrollments.reduce((s: number, e: any) => s + (e.progress_pct || 0), 0) / totalStudents) : 0;
  const completedQuizzes = quizAttempts.filter((a: any) => a.completed_at);
  const quizPassRate = completedQuizzes.length > 0 ? Math.round((completedQuizzes.filter((a: any) => a.passed).length / completedQuizzes.length) * 100) : 0;

  // Lesson drop-off data
  const lessonDropOff = lessons.map((l: any) => {
    const completions = lessonProgress.filter((p: any) => p.lesson_id === l.id).length;
    return { name: l.title?.substring(0, 15) || `L${l.sort_order}`, students: completions };
  });

  // Progress distribution pie
  const progressDist = [
    { name: '0-25%', value: enrollments.filter((e: any) => (e.progress_pct || 0) <= 25).length },
    { name: '26-50%', value: enrollments.filter((e: any) => (e.progress_pct || 0) > 25 && (e.progress_pct || 0) <= 50).length },
    { name: '51-75%', value: enrollments.filter((e: any) => (e.progress_pct || 0) > 50 && (e.progress_pct || 0) <= 75).length },
    { name: '76-100%', value: enrollments.filter((e: any) => (e.progress_pct || 0) > 75).length },
  ].filter(d => d.value > 0);

  const stats = [
    { label: 'Total Students', value: totalStudents, icon: Users },
    { label: 'Completion Rate', value: `${completionRate}%`, icon: CheckCircle },
    { label: 'Avg Progress', value: `${avgProgress}%`, icon: TrendingUp },
    { label: 'Quiz Pass Rate', value: `${quizPassRate}%`, icon: BarChart3 },
  ];

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="font-heading text-2xl font-bold">Course Analytics</h2>
        <Select value={courseId || ''} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Select course" /></SelectTrigger>
          <SelectContent>{courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!courseId ? (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted" />
          <p>No courses found.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-heading text-xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lesson completion drop-off */}
            <div className="bg-card border rounded-xl p-6">
              <h3 className="font-heading font-bold text-sm mb-4">Lesson Completion (Drop-off)</h3>
              {lessonDropOff.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={lessonDropOff}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="students" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No lesson data</p>
              )}
            </div>

            {/* Progress distribution */}
            <div className="bg-card border rounded-xl p-6">
              <h3 className="font-heading font-bold text-sm mb-4">Student Progress Distribution</h3>
              {progressDist.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={progressDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {progressDist.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {progressDist.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span>{d.name}: {d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No students enrolled</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default InstructorAnalytics;
