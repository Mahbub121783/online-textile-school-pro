import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, Users, DollarSign, TrendingUp, Star, FileQuestion, PlusCircle, BarChart3, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, subDays, isAfter } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const InstructorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState('30');

  const { data: courses = [] } = useQuery({
    queryKey: ['instructor-courses', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title, slug, enrollment_count, avg_rating, price, is_published, review_status, thumbnail_url')
        .eq('instructor_id', user!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['instructor-enrollments', user?.id],
    enabled: !!user && courses.length > 0,
    queryFn: async () => {
      const courseIds = courses.map((c: any) => c.id);
      const { data } = await supabase
        .from('enrollments')
        .select('id, course_id, enrolled_at')
        .in('course_id', courseIds);
      return data ?? [];
    },
  });

  // Quiz attempts + assignment submissions for activity feed
  const { data: recentActivity = [] } = useQuery({
    queryKey: ['instructor-activity', user?.id],
    enabled: !!user && courses.length > 0,
    queryFn: async () => {
      const courseIds = courses.map((c: any) => c.id);
      const activities: any[] = [];

      // Recent enrollments
      const { data: recentEnr } = await supabase.from('enrollments')
        .select('id, course_id, enrolled_at, user_profiles:user_id(full_name)')
        .in('course_id', courseIds)
        .order('enrolled_at', { ascending: false })
        .limit(5);
      (recentEnr ?? []).forEach((e: any) => {
        activities.push({ type: 'enrollment', name: e.user_profiles?.full_name || 'Student', course: courses.find((c: any) => c.id === e.course_id)?.title, date: e.enrolled_at });
      });

      // Recent quiz attempts
      const { data: quizzes } = await supabase.from('quizzes').select('id, title, course_id').in('course_id', courseIds);
      if (quizzes?.length) {
        const { data: attempts } = await supabase.from('quiz_attempts')
          .select('id, quiz_id, completed_at, percentage, user_profiles:user_id(full_name)')
          .in('quiz_id', quizzes.map(q => q.id))
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(5);
        (attempts ?? []).forEach((a: any) => {
          const quiz = quizzes.find((q: any) => q.id === a.quiz_id);
          activities.push({ type: 'quiz', name: a.user_profiles?.full_name || 'Student', course: quiz?.title, date: a.completed_at, extra: `${a.percentage}%` });
        });
      }

      // Recent assignment submissions
      const { data: assigns } = await supabase.from('assignments').select('id, title, course_id').in('course_id', courseIds);
      if (assigns?.length) {
        const { data: subs } = await supabase.from('assignment_submissions')
          .select('id, assignment_id, submitted_at, status, user_profiles:user_id(full_name)')
          .in('assignment_id', assigns.map(a => a.id))
          .order('submitted_at', { ascending: false })
          .limit(5);
        (subs ?? []).forEach((s: any) => {
          const assign = assigns.find((a: any) => a.id === s.assignment_id);
          activities.push({ type: 'assignment', name: s.user_profiles?.full_name || 'Student', course: assign?.title, date: s.submitted_at, extra: s.status });
        });
      }

      return activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
    },
  });

  // Filter enrollments by date range
  const cutoff = subDays(new Date(), Number(range));
  const filteredEnrollments = enrollments.filter((e: any) => isAfter(new Date(e.enrolled_at), cutoff));

  // Build chart data - enrollments per day
  const chartMap: Record<string, number> = {};
  for (let i = Number(range) - 1; i >= 0; i--) {
    const day = format(subDays(new Date(), i), 'MMM dd');
    chartMap[day] = 0;
  }
  filteredEnrollments.forEach((e: any) => {
    const day = format(new Date(e.enrolled_at), 'MMM dd');
    if (chartMap[day] !== undefined) chartMap[day]++;
  });
  const chartData = Object.entries(chartMap).map(([date, count]) => ({ date, enrollments: count }));

  const totalStudents = enrollments.length;
  const publishedCount = courses.filter((c: any) => c.is_published).length;
  const avgRating = courses.length
    ? (courses.reduce((s: number, c: any) => s + (c.avg_rating || 0), 0) / courses.length).toFixed(1)
    : '0.0';
  const estRevenue = enrollments.reduce((sum: number, e: any) => {
    const course = courses.find((c: any) => c.id === e.course_id);
    return sum + (course?.price || 0) * 0.7;
  }, 0);

  const stats = [
    { label: 'Total Courses', value: courses.length, icon: BookOpen, color: 'text-primary' },
    { label: 'Published', value: publishedCount, icon: TrendingUp, color: 'text-accent' },
    { label: 'Total Students', value: totalStudents, icon: Users, color: 'text-primary' },
    { label: 'Avg. Rating', value: avgRating, icon: Star, color: 'text-accent' },
    { label: 'Est. Revenue', value: `৳${Math.round(estRevenue).toLocaleString()}`, icon: DollarSign, color: 'text-primary' },
    { label: 'Pending Review', value: courses.filter((c: any) => c.review_status === 'pending').length, icon: FileQuestion, color: 'text-accent' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading text-2xl font-bold">Instructor Dashboard</h2>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/instructor/courses/new')}>
          <PlusCircle className="h-4 w-4" /> Create Course
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/instructor/revenue')}>
          <DollarSign className="h-4 w-4" /> Revenue
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/instructor/analytics')}>
          <BarChart3 className="h-4 w-4" /> Analytics
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/instructor/wallet')}>
          <Wallet className="h-4 w-4" /> Wallet
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border rounded-xl p-4 md:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="font-heading text-xl md:text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Enrollment Trend Chart */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-heading font-bold text-sm mb-4">Enrollment Trend ({range} days)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(chartData.length / 7) - 1)} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="enrollments" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Feed */}
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-heading font-bold text-sm mb-4">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((a: any, i: number) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    a.type === 'enrollment' ? 'bg-primary' : a.type === 'quiz' ? 'bg-accent' : 'bg-muted-foreground'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">
                      <span className="font-medium">{a.name}</span>
                      {' '}
                      {a.type === 'enrollment' ? 'enrolled in' : a.type === 'quiz' ? 'completed quiz' : 'submitted'}
                      {' '}
                      <span className="text-muted-foreground">{a.course}</span>
                      {a.extra && <span className="ml-1 text-xs text-muted-foreground">({a.extra})</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{format(new Date(a.date), 'dd MMM, HH:mm')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Courses */}
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-sm">Your Courses</h3>
            <button onClick={() => navigate('/instructor/courses/new')} className="text-sm text-primary hover:underline font-medium">+ New</button>
          </div>
          {courses.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">No courses yet.</p>
          ) : (
            <div className="space-y-2">
              {courses.slice(0, 5).map((course: any) => (
                <div key={course.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate(`/instructor/courses/${course.id}`)}>
                  <img src={course.thumbnail_url || '/placeholder.svg'} alt={course.title} className="w-14 h-10 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{course.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{course.enrollment_count || 0} students</span>
                      <span>★ {course.avg_rating || 0}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    course.is_published ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' :
                    course.review_status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {course.is_published ? 'Published' : course.review_status === 'pending' ? 'Pending' : 'Draft'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstructorDashboard;
