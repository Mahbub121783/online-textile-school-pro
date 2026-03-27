import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DollarSign, TrendingUp, Users, BookOpen } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

const RevenueDashboard = () => {
  const { user } = useAuth();

  const { data: courses = [] } = useQuery({
    queryKey: ['instructor-courses-revenue', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title, price, discount_price, enrollment_count, revenue_share_pct')
        .eq('instructor_id', user!.id)
        .eq('is_published', true);
      return data ?? [];
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['instructor-revenue-enrollments', user?.id],
    enabled: !!user && courses.length > 0,
    queryFn: async () => {
      const courseIds = courses.map((c: any) => c.id);
      const { data } = await supabase
        .from('enrollments')
        .select('id, course_id, enrolled_at')
        .in('course_id', courseIds)
        .order('enrolled_at', { ascending: false });
      return data ?? [];
    },
  });

  // Calculate revenue per course
  const courseRevenue = courses.map((course: any) => {
    const courseEnrollments = enrollments.filter((e: any) => e.course_id === course.id);
    const pricePerStudent = course.discount_price || course.price || 0;
    const sharePct = (course.revenue_share_pct || 70) / 100;
    const gross = courseEnrollments.length * pricePerStudent;
    const net = gross * sharePct;
    return { ...course, enrollments: courseEnrollments.length, gross, net };
  });

  const totalGross = courseRevenue.reduce((s, c) => s + c.gross, 0);
  const totalNet = courseRevenue.reduce((s, c) => s + c.net, 0);
  const totalStudents = enrollments.length;

  // Recent enrollments
  const recentEnrollments = enrollments.slice(0, 10).map((e: any) => {
    const course = courses.find((c: any) => c.id === e.course_id);
    return { ...e, courseTitle: course?.title, coursePrice: course?.discount_price || course?.price || 0 };
  });

  const stats = [
    { label: 'Gross Revenue', value: `৳${totalGross.toLocaleString()}`, icon: DollarSign, color: 'text-primary' },
    { label: 'Your Earnings (70%)', value: `৳${Math.round(totalNet).toLocaleString()}`, icon: TrendingUp, color: 'text-accent' },
    { label: 'Total Students', value: totalStudents, icon: Users, color: 'text-primary' },
    { label: 'Active Courses', value: courses.length, icon: BookOpen, color: 'text-accent' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">Revenue Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Revenue by course */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-heading font-bold text-lg mb-4">Revenue by Course</h3>
        {courseRevenue.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No published courses yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead className="text-right">Your Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courseRevenue.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-sm">{c.title}</TableCell>
                  <TableCell className="text-sm">৳{c.discount_price || c.price}</TableCell>
                  <TableCell className="text-sm">{c.enrollments}</TableCell>
                  <TableCell className="text-sm">৳{c.gross.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm font-medium text-primary">৳{Math.round(c.net).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold">
                <TableCell>Total</TableCell>
                <TableCell></TableCell>
                <TableCell>{totalStudents}</TableCell>
                <TableCell>৳{totalGross.toLocaleString()}</TableCell>
                <TableCell className="text-right text-primary">৳{Math.round(totalNet).toLocaleString()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>

      {/* Recent enrollments */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-heading font-bold text-lg mb-4">Recent Enrollments</h3>
        {recentEnrollments.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No enrollments yet.</p>
        ) : (
          <div className="space-y-2">
            {recentEnrollments.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{e.courseTitle}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(e.enrolled_at), 'dd MMM yyyy, HH:mm')}</p>
                </div>
                <span className="text-sm font-medium text-primary">+৳{e.coursePrice}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RevenueDashboard;
