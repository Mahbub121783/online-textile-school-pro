import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BookOpen, DollarSign, GraduationCap, Activity, CreditCard, UserCog, ShoppingCart, Clock, ArrowRight, Shield, Download, TrendingUp } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const AdminDashboard = () => {
  const { isSuperAdmin } = useAuth();

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

  // Revenue trend (last 30 days) - super admin only
  const { data: revenueTrend } = useQuery({
    queryKey: ['admin-revenue-trend'],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data } = await supabase
        .from('orders')
        .select('total, created_at')
        .eq('status', 'completed')
        .gte('created_at', thirtyDaysAgo);

      const dailyMap: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const day = format(subDays(new Date(), i), 'MMM d');
        dailyMap[day] = 0;
      }
      (data || []).forEach((o: any) => {
        const day = format(new Date(o.created_at), 'MMM d');
        if (dailyMap[day] !== undefined) dailyMap[day] += Number(o.total);
      });

      return Object.entries(dailyMap).map(([date, revenue]) => ({ date, revenue }));
    },
    enabled: isSuperAdmin,
  });

  // User growth (last 30 days) - super admin only
  const { data: userGrowth } = useQuery({
    queryKey: ['admin-user-growth'],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data } = await supabase
        .from('user_profiles')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo);

      const dailyMap: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const day = format(subDays(new Date(), i), 'MMM d');
        dailyMap[day] = 0;
      }
      (data || []).forEach((u: any) => {
        if (u.created_at) {
          const day = format(new Date(u.created_at), 'MMM d');
          if (dailyMap[day] !== undefined) dailyMap[day]++;
        }
      });

      return Object.entries(dailyMap).map(([date, signups]) => ({ date, signups }));
    },
    enabled: isSuperAdmin,
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

  // Pending items for super admin
  const { data: pendingItems } = useQuery({
    queryKey: ['admin-pending-items'],
    queryFn: async () => {
      const [pendingApps, pendingCourses] = await Promise.all([
        supabase.from('instructor_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('review_status', 'pending'),
      ]);
      return {
        pendingApplications: pendingApps.count ?? 0,
        pendingCourseReviews: pendingCourses.count ?? 0,
      };
    },
    enabled: isSuperAdmin,
  });

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-primary', link: '/admin/users' },
    { label: 'Active Courses', value: stats?.activeCourses ?? 0, icon: BookOpen, color: 'text-accent', link: '/admin/cms/courses' },
    { label: 'Instructors', value: stats?.totalInstructors ?? 0, icon: UserCog, color: 'text-primary', link: '/admin/instructors' },
    { label: 'Enrollments', value: stats?.totalEnrollments ?? 0, icon: GraduationCap, color: 'text-accent', link: '/admin/cms' },
    { label: 'Total Revenue', value: `৳${(stats?.totalRevenue ?? 0).toLocaleString()}`, icon: DollarSign, color: 'text-primary', link: '/admin/payment' },
    { label: 'Pending Orders', value: stats?.pendingOrders ?? 0, icon: ShoppingCart, color: 'text-destructive', link: '/admin/payment' },
    { label: 'Pending Withdrawals', value: stats?.pendingWithdrawals ?? 0, icon: Clock, color: 'text-destructive', link: '/admin/instructors/financials' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">
            {isSuperAdmin ? 'Super Admin Dashboard' : 'Dashboard Overview'}
          </h2>
          {isSuperAdmin && (
            <p className="text-sm text-muted-foreground mt-1">Full system overview with analytics</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
              <Shield className="h-3 w-3 mr-1" /> Super Admin
            </Badge>
          )}
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>

      {/* Stat Cards */}
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

      {/* Super Admin: Pending Items Banner */}
      {isSuperAdmin && pendingItems && (pendingItems.pendingApplications > 0 || pendingItems.pendingCourseReviews > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {pendingItems.pendingApplications > 0 && (
            <Link to="/admin/instructors">
              <Card className="border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 transition-colors">
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCog className="h-5 w-5 text-amber-500" />
                    <span className="text-sm font-medium">{pendingItems.pendingApplications} Pending Instructor Applications</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          )}
          {pendingItems.pendingCourseReviews > 0 && (
            <Link to="/admin/cms/courses">
              <Card className="border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 transition-colors">
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-amber-500" />
                    <span className="text-sm font-medium">{pendingItems.pendingCourseReviews} Courses Pending Review</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      )}

      {/* Super Admin: Charts */}
      {isSuperAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Revenue Trend (30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                      formatter={(value: any) => [`৳${Number(value).toLocaleString()}`, 'Revenue']}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" /> User Signups (30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userGrowth || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Bar dataKey="signups" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
        {isSuperAdmin && (
          <>
            <Link to="/admin/admin-management">
              <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                <Shield className="h-4 w-4 text-amber-500" />
                <div className="text-left">
                  <p className="text-sm font-medium">Manage Admins</p>
                  <p className="text-xs text-muted-foreground">Roles & access</p>
                </div>
              </Button>
            </Link>
            <Link to="/admin/system-controls">
              <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                <Download className="h-4 w-4 text-primary" />
                <div className="text-left">
                  <p className="text-sm font-medium">System Controls</p>
                  <p className="text-xs text-muted-foreground">Exports & health</p>
                </div>
              </Button>
            </Link>
          </>
        )}
        {!isSuperAdmin && (
          <>
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
          </>
        )}
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
