import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Users, GraduationCap, DollarSign, TrendingUp, BarChart3, ArrowRight } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Link } from 'react-router-dom';

const CourseDashboardTab = () => {
  const [range, setRange] = useState('30');

  const { data: stats } = useQuery({
    queryKey: ['admin-course-stats'],
    queryFn: async () => {
      const [coursesRes, enrollmentsRes, instructorsRes, ordersRes] = await Promise.all([
        supabase.from('courses').select('id, review_status, is_published', { count: 'exact' }),
        supabase.from('enrollments').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('user_id').eq('role', 'instructor'),
        supabase.from('orders').select('total').eq('status', 'completed'),
      ]);
      const courses = coursesRes.data ?? [];
      const published = courses.filter(c => c.is_published).length;
      const pending = courses.filter(c => c.review_status === 'pending').length;
      const draft = courses.filter(c => c.review_status === 'draft').length;
      const totalRevenue = ordersRes.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0;

      return {
        totalCourses: courses.length,
        publishedCourses: published,
        pendingCourses: pending,
        draftCourses: draft,
        totalEnrollments: enrollmentsRes.count ?? 0,
        totalInstructors: instructorsRes.data?.length ?? 0,
        totalRevenue,
      };
    },
  });

  const { data: enrollmentChart = [] } = useQuery({
    queryKey: ['admin-enrollment-chart', range],
    queryFn: async () => {
      const days = parseInt(range);
      const since = startOfDay(subDays(new Date(), days)).toISOString();
      const { data } = await supabase
        .from('enrollments')
        .select('enrolled_at')
        .gte('enrolled_at', since)
        .order('enrolled_at');

      const buckets: Record<string, number> = {};
      for (let i = 0; i < days; i++) {
        const d = format(subDays(new Date(), days - 1 - i), 'MMM d');
        buckets[d] = 0;
      }
      data?.forEach(e => {
        if (e.enrolled_at) {
          const key = format(new Date(e.enrolled_at), 'MMM d');
          if (key in buckets) buckets[key]++;
        }
      });
      return Object.entries(buckets).map(([date, count]) => ({ date, enrollments: count }));
    },
  });

  const { data: revenueChart = [] } = useQuery({
    queryKey: ['admin-revenue-chart', range],
    queryFn: async () => {
      const days = parseInt(range);
      const since = startOfDay(subDays(new Date(), days)).toISOString();
      const { data } = await supabase
        .from('orders')
        .select('total, created_at')
        .eq('status', 'completed')
        .gte('created_at', since);

      const buckets: Record<string, number> = {};
      for (let i = 0; i < days; i++) {
        const d = format(subDays(new Date(), days - 1 - i), 'MMM d');
        buckets[d] = 0;
      }
      data?.forEach(o => {
        if (o.created_at) {
          const key = format(new Date(o.created_at), 'MMM d');
          if (key in buckets) buckets[key] += Number(o.total);
        }
      });
      return Object.entries(buckets).map(([date, revenue]) => ({ date, revenue }));
    },
  });

  const cards = [
    { label: 'Total Courses', value: stats?.totalCourses ?? 0, icon: BookOpen, color: 'text-primary', link: '/admin/cms/courses' },
    { label: 'Published', value: stats?.publishedCourses ?? 0, icon: TrendingUp, color: 'text-accent', link: '/admin/cms/courses' },
    { label: 'Pending Review', value: stats?.pendingCourses ?? 0, icon: BarChart3, color: 'text-warning', link: '/admin/instructors' },
    { label: 'Instructors', value: stats?.totalInstructors ?? 0, icon: Users, color: 'text-primary', link: '/admin/instructors' },
    { label: 'Enrollments', value: stats?.totalEnrollments ?? 0, icon: GraduationCap, color: 'text-accent', link: '/admin/cms/gradebook' },
    { label: 'Revenue', value: `৳${(stats?.totalRevenue ?? 0).toLocaleString()}`, icon: DollarSign, color: 'text-primary', link: '/admin/payment' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map(c => (
          <Link key={c.label} to={c.link} className="group">
            <Card className="transition-all duration-200 hover:shadow-md hover:border-primary/30 group-hover:scale-[1.02]">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <c.icon className={`h-4 w-4 ${c.color} shrink-0`} />
                  <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xl font-bold font-heading">{c.value}</p>
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="flex justify-end">
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading">Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={enrollmentChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="enrollments" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-heading">Revenue</CardTitle>
              <Link to="/admin/payment" className="text-xs text-primary hover:underline">Detailed →</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CourseDashboardTab;
