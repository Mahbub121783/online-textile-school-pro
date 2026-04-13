import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart3, TrendingUp, BookOpen, Award, Clock, Target } from 'lucide-react';

const StudentAnalytics = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalCourses: 0,
    completedCourses: 0,
    avgProgress: 0,
    totalQuizzes: 0,
    avgQuizScore: 0,
    totalAssignments: 0,
    avgAssignmentScore: 0,
    certificates: 0,
    quizScores: [] as { label: string; score: number; max: number }[],
    courseProgress: [] as { title: string; progress: number }[],
    assignmentScores: [] as { label: string; score: number; max: number }[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchAnalytics();
  }, [user]);

  const fetchAnalytics = async () => {
    if (!user) return;
    setLoading(true);

    const [enrollRes, quizAttemptRes, assignRes, certRes] = await Promise.all([
      supabase.from('enrollments').select('*, courses(title)').eq('user_id', user.id),
      supabase.from('quiz_attempts').select('*, quizzes(title, passing_score)').eq('user_id', user.id).order('completed_at', { ascending: false }),
      supabase.from('assignment_submissions').select('*, assignments(title, max_score)').eq('user_id', user.id),
      supabase.from('certificates').select('id').eq('user_id', user.id),
    ]);

    const enrollments = enrollRes.data || [];
    const quizAttempts = quizAttemptRes.data || [];
    const assignments = assignRes.data || [];
    const certificates = certRes.data || [];

    const completedCourses = enrollments.filter(e => e.completed_at).length;
    const avgProgress = enrollments.length > 0 ? enrollments.reduce((s, e) => s + (e.progress_pct || 0), 0) / enrollments.length : 0;

    // Unique quizzes with best scores
    const quizMap = new Map<string, { label: string; score: number; max: number }>();
    quizAttempts.forEach((a: any) => {
      const key = a.quiz_id;
      const existing = quizMap.get(key);
      if (!existing || a.score > existing.score) {
        quizMap.set(key, { label: a.quizzes?.title || 'Quiz', score: a.score || 0, max: a.quizzes?.passing_score || 100 });
      }
    });
    const quizScores = Array.from(quizMap.values()).slice(0, 10);
    const avgQuizScore = quizScores.length > 0 ? quizScores.reduce((s, q) => s + (q.score / Math.max(q.max, 1)) * 100, 0) / quizScores.length : 0;

    const assignmentScores = assignments.filter((a: any) => a.score != null).map((a: any) => ({
      label: a.assignments?.title || 'Assignment',
      score: a.score || 0,
      max: a.assignments?.max_score || 100,
    })).slice(0, 10);
    const avgAssignmentScore = assignmentScores.length > 0 ? assignmentScores.reduce((s, a) => s + (a.score / Math.max(a.max, 1)) * 100, 0) / assignmentScores.length : 0;

    const courseProgress = enrollments.map((e: any) => ({ title: e.courses?.title || 'Course', progress: e.progress_pct || 0 }));

    setStats({
      totalCourses: enrollments.length,
      completedCourses,
      avgProgress: Math.round(avgProgress),
      totalQuizzes: quizScores.length,
      avgQuizScore: Math.round(avgQuizScore),
      totalAssignments: assignments.length,
      avgAssignmentScore: Math.round(avgAssignmentScore),
      certificates: certificates.length,
      quizScores,
      courseProgress,
      assignmentScores,
    });
    setLoading(false);
  };

  if (loading) return <div className="animate-pulse text-muted-foreground p-8">Loading analytics...</div>;

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6" /> My Analytics</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <BookOpen className="h-8 w-8 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">{stats.totalCourses}</p>
          <p className="text-sm text-muted-foreground">Enrolled Courses</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Target className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
          <p className="text-2xl font-bold">{stats.completedCourses}</p>
          <p className="text-sm text-muted-foreground">Completed</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <TrendingUp className="h-8 w-8 mx-auto text-blue-500 mb-2" />
          <p className="text-2xl font-bold">{stats.avgQuizScore}%</p>
          <p className="text-sm text-muted-foreground">Avg Quiz Score</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Award className="h-8 w-8 mx-auto text-amber-500 mb-2" />
          <p className="text-2xl font-bold">{stats.certificates}</p>
          <p className="text-sm text-muted-foreground">Certificates</p>
        </CardContent></Card>
      </div>

      {/* Course Progress */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Course Progress</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {stats.courseProgress.length === 0 && <p className="text-muted-foreground text-sm">No courses enrolled yet.</p>}
          {stats.courseProgress.map((c, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm mb-1">
                <span className="truncate max-w-[70%]">{c.title}</span>
                <span className="font-medium">{c.progress}%</span>
              </div>
              <Progress value={c.progress} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quiz & Assignment Scores */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-lg">Quiz Scores</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats.quizScores.length === 0 && <p className="text-muted-foreground text-sm">No quizzes attempted.</p>}
            {stats.quizScores.map((q, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm truncate max-w-[60%]">{q.label}</span>
                <div className="flex items-center gap-2">
                  <Progress value={(q.score / Math.max(q.max, 1)) * 100} className="h-2 w-20" />
                  <span className="text-sm font-medium w-16 text-right">{q.score}/{q.max}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Assignment Scores</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats.assignmentScores.length === 0 && <p className="text-muted-foreground text-sm">No graded assignments.</p>}
            {stats.assignmentScores.map((a, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm truncate max-w-[60%]">{a.label}</span>
                <div className="flex items-center gap-2">
                  <Progress value={(a.score / Math.max(a.max, 1)) * 100} className="h-2 w-20" />
                  <span className="text-sm font-medium w-16 text-right">{a.score}/{a.max}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Overall Performance */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Overall Performance Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-primary">{stats.avgProgress}%</p>
              <p className="text-xs text-muted-foreground mt-1">Avg Course Progress</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-500">{stats.avgQuizScore}%</p>
              <p className="text-xs text-muted-foreground mt-1">Avg Quiz Score</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-500">{stats.avgAssignmentScore}%</p>
              <p className="text-xs text-muted-foreground mt-1">Avg Assignment Score</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-500">{stats.totalQuizzes + stats.totalAssignments}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Assessments</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentAnalytics;
