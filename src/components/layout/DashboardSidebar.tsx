import { BookOpen, LayoutDashboard, Library, Wallet, Settings, LogOut, FileQuestion, ClipboardList, Award, Users, FileText, Bell, ShoppingCart, Heart, Trophy, MessageSquare, ClipboardCheck, GraduationCap, FolderKanban, BarChart3, CalendarCheck, FlaskConical, Briefcase, Mail, AtSign, Presentation, Brain } from 'lucide-react';
import ProfileCompletenessWidget from '@/components/ProfileCompletenessWidget';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEnrollments } from '@/hooks/useEnrollments';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const baseNavItems = [
  { title: 'Overview', url: '/dashboard', icon: LayoutDashboard },
  { title: 'My Orders', url: '/dashboard/orders', icon: ShoppingCart },
  { title: 'My Courses', url: '/dashboard/courses', icon: BookOpen },
  { title: 'My eBooks', url: '/dashboard/ebooks', icon: Library },
  { title: 'Wishlist', url: '/dashboard/wishlist', icon: Heart },
  { title: 'Quizzes', url: '/dashboard/quizzes', icon: FileQuestion },
  { title: 'Assignments', url: '/dashboard/assignments', icon: ClipboardList },
  { title: 'Certificates', url: '/dashboard/certificates', icon: Award },
  { title: 'Leaderboard', url: '/dashboard/leaderboard', icon: Trophy },
  { title: 'Practice Arena', url: '/dashboard/practice', icon: Brain },
  { title: 'Peer Reviews', url: '/dashboard/peer-reviews', icon: ClipboardCheck },
  { title: 'Attendance', url: '/dashboard/attendance', icon: CalendarCheck },
  { title: 'Transcript', url: '/dashboard/transcript', icon: GraduationCap },
  { title: 'Group Projects', url: '/dashboard/group-projects', icon: FolderKanban },
  { title: 'Analytics', url: '/dashboard/analytics', icon: BarChart3 },
  { title: 'My Research', url: '/dashboard/my-research', icon: FlaskConical },
  { title: 'My Internships', url: '/dashboard/internships', icon: Briefcase },
  { title: 'Invoices', url: '/dashboard/invoices', icon: FileText },
  { title: 'Referrals', url: '/dashboard/referrals', icon: Users },
  { title: 'Workshops', url: '/dashboard/workshops', icon: Presentation },
  { title: 'Forum', url: '/forum', icon: MessageSquare },
  { title: 'Notifications', url: '/dashboard/notifications', icon: Bell },
  { title: 'Wallet', url: '/dashboard/wallet', icon: Wallet },
  { title: 'Settings', url: '/dashboard/settings', icon: Settings },
];

const enrolledOnlyItems = [
  { title: 'EduMail', url: '/dashboard/edumail', icon: AtSign },
  { title: 'Mail', url: '/dashboard/mail', icon: Mail },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { signOut, profile, user } = useAuth();
  const { data: enrollments } = useEnrollments();

  const hasPurchasedCourse = (enrollments ?? []).length > 0;

  // Mail (the actual inbox) must stay hidden until the student's EduMail
  // request is approved & provisioned -- previously it showed for any
  // enrolled student regardless of request status, exposing an inbox page
  // with no working account behind it.
  const { data: emailReq } = useQuery({
    queryKey: ['my-edumail', user?.id],
    enabled: !!user && hasPurchasedCourse,
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data } = await supabase
        .from('institutional_email_requests')
        .select('status')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1);
      return (data?.[0] as any) || null;
    },
  });
  const mailApproved = emailReq?.status === 'approved';

  // Insert EduMail (always, once enrolled) + Mail (only once approved)
  const visibleEnrolledItems = hasPurchasedCourse
    ? enrolledOnlyItems.filter((i) => i.title !== 'Mail' || mailApproved)
    : [];
  const navItems = hasPurchasedCourse
    ? [...baseNavItems.slice(0, 22), ...visibleEnrolledItems, ...baseNavItems.slice(22)]
    : baseNavItems;

  const isActive = (path: string) =>
    path === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <div className="p-4 border-b">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile?.full_name || 'Profile'}
                  className="w-10 h-10 rounded-full object-cover border"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-heading font-bold text-lg">
                  {profile?.full_name?.[0]?.toUpperCase() || 'S'}
                </div>
              )}
              <p className="mt-2 font-heading font-semibold text-sm truncate">{profile?.full_name || 'Student'}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.roll_id}</p>
              <div className="mt-3">
                <ProfileCompletenessWidget compact />
              </div>
            </div>
          )}
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/dashboard'}
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <Button variant="ghost" size="sm" className="w-full justify-start text-destructive" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && 'Sign Out'}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
