import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BookOpen, DollarSign, GraduationCap, Activity, CreditCard, UserCog, ShoppingCart, Clock, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const AdminDashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [usersRes, coursesRes, enrollmentsRes, ordersRes, instructorsRes, pendingOrdersRes, withdrawalsRes] = await Promise.all([
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('enrollments').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('total').eq('status', 'completed'),
        supabase.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'instructor'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('wallet_transactions').select('id', { count: 'exact', head: true }).eq('type', 'withdrawal_request'),
      ]);
      const totalRevenue = ordersRes.data?.reduce((sum, o) => sum + Number(o.total), 0) ?? 0;
      return {
        totalUsers: usersRes.count ?? 0,
        activeCourses: coursesRes.count ?? 0,
        totalEnrollments: enrollmentsRes.count ?? 0,
        totalRevenue,
        totalInstructors: instructorsRes.count ?? 0,
        pendingOrders: pendingOrdersRes.count ?? 0,
        pendingWithdrawals: withdrawalsRes.count ?? 0,
      };
    },
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['admin-recent-activity'],
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_activity_log' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: recentEnrollments } = useQuery({
    queryKey: ['admin-recent-enrollments'],
    queryFn: async () => {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('*')
        .order('enrolled_at', { ascending: false })
        .limit(8);
      if (!enrollments || enrollments.length === 0) return [];
      
      const userIds = [...new Set(enrollments.map(e => e.user_id))];
      const courseIds = [...new Set(enrollments.map(e => e.course_id))];
      
      const [{ data: profiles }, { data: courses }] = await Promise.all([
        supabase.from('user_profiles').select('id, full_name').in('id', userIds),
        supabase.from('courses').select('id, title').in('id', courseIds),
      ]);
      
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      const courseMap = Object.fromEntries((courses || []).map(c => [c.id, c]));
      
      return enrollments.map(e => ({
        ...e,
        user_profiles: profileMap[e.user_id] || null,
        courses: courseMap[e.course_id] || null,
      }));
    },
  });

  const { data: recentOrders } = useQuery({
    queryKey: ['admin-recent-orders-dash'],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      if (!orders || orders.length === 0) return [];
      
      const userIds = [...new Set(orders.map(o => o.user_id))];
      const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      
      return orders.map(o => ({
        ...o,
        user_profiles: profileMap[o.user_id] || null,
      }));
    },
  });

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-primary', link: '/admin/users' },
    { label: 'Active Courses', value: stats?.activeCourses ?? 0, icon: BookOpen, color: 'text-accent', link: '/admin/cms/courses' },
    { label: 'Instructors', value: stats?.totalInstructors ?? 0, icon: UserCog, color: 'text-primary', link: '/admin/instructors' },
    { label: 'Enrollments', value: stats?.totalEnrollments ?? 0, icon: GraduationCap, color: 'text-accent', link: '/admin/cms' },
    { label: 'Total Revenue', value: `৳${(stats?.totalRevenue ?? 0).toLocaleString()}`, icon: DollarSign, color: 'text-primary', link: '/admin/payment' },
    { label: 'Pending Orders', value: stats?.pendingOrders ?? 0, icon: ShoppingCart, color: 'text-warning', link: '/admin/payment' },
    { label: 'Pending Withdrawals', value: stats?.pendingWithdrawals ?? 0, icon: Clock, color: 'text-destructive', link: '/admin/instructors/financials' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">Dashboard Overview</h2>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {statCards.map((s) => (
          <Link key={s.label} to={s.link} className="group">
            <Card className="transition-all duration-200 hover:shadow-md hover:border-primary/30 group-hover:scale-[1.02]">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <s.icon className={`h-5 w-5 ${s.color} opacity-80`} />
                  <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xl font-bold font-heading">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to="/admin/payment">
          <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
            <CreditCard className="h-4 w-4 text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium">Payment Dashboard</p>
              <p className="text-xs text-muted-foreground">Revenue & analytics</p>
            </div>
          </Button>
        </Link>
        <Link to="/admin/instructors/financials">
          <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
            <DollarSign className="h-4 w-4 text-accent" />
            <div className="text-left">
              <p className="text-sm font-medium">Instructor Financials</p>
              <p className="text-xs text-muted-foreground">Withdrawals & revenue</p>
            </div>
          </Button>
        </Link>
        <Link to="/admin/cms/courses">
          <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
            <BookOpen className="h-4 w-4 text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium">Manage Courses</p>
              <p className="text-xs text-muted-foreground">CMS content</p>
            </div>
          </Button>
        </Link>
        <Link to="/admin/users">
          <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
            <Users className="h-4 w-4 text-accent" />
            <div className="text-left">
              <p className="text-sm font-medium">User Management</p>
              <p className="text-xs text-muted-foreground">Roles & access</p>
            </div>
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Enrollments */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-base">Recent Enrollments</CardTitle>
              <Link to="/admin/cms" className="text-xs text-primary hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentEnrollments?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No enrollments yet.</p>
            ) : (
              <div className="space-y-3">
                {recentEnrollments?.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{e.user_profiles?.full_name || 'Unknown'}</p>
                      <p className="text-muted-foreground text-xs truncate">{e.courses?.title}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {e.enrolled_at ? format(new Date(e.enrolled_at), 'MMM d') : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-base">Recent Orders</CardTitle>
              <Link to="/admin/payment" className="text-xs text-primary hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            {(!recentOrders || recentOrders.length === 0) ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{(o.user_profiles as any)?.full_name || 'Unknown'}</p>
                      <p className="text-muted-foreground text-xs">{o.payment_method || 'N/A'}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-medium">৳{Number(o.total).toLocaleString()}</p>
                      <Badge variant={o.status === 'completed' ? 'default' : 'secondary'} className="text-[10px] h-4">
                        {o.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Activity
              </CardTitle>
              <Link to="/admin/activity" className="text-xs text-primary hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            {(!recentActivity || recentActivity.length === 0) ? (
              <p className="text-sm text-muted-foreground">No admin activity yet.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.action}</p>
                      <p className="text-muted-foreground text-xs">{a.target_type} · {a.target_id?.slice(0, 8)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {a.created_at ? format(new Date(a.created_at), 'MMM d, HH:mm') : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
