import { BookOpen, LayoutDashboard, Library, Wallet, Settings, LogOut, FileQuestion, ClipboardList, Award, Users, FileText, Bell, ShoppingCart, Heart, Trophy, MessageSquare, ClipboardCheck, GraduationCap, FolderKanban, BarChart3, CalendarCheck } from 'lucide-react';
import ProfileCompletenessWidget from '@/components/ProfileCompletenessWidget';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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

const navItems = [
  { title: 'Overview', url: '/dashboard', icon: LayoutDashboard },
  { title: 'My Orders', url: '/dashboard/orders', icon: ShoppingCart },
  { title: 'My Courses', url: '/dashboard/courses', icon: BookOpen },
  { title: 'My eBooks', url: '/dashboard/ebooks', icon: Library },
  { title: 'Wishlist', url: '/dashboard/wishlist', icon: Heart },
  { title: 'Quizzes', url: '/dashboard/quizzes', icon: FileQuestion },
  { title: 'Assignments', url: '/dashboard/assignments', icon: ClipboardList },
  { title: 'Certificates', url: '/dashboard/certificates', icon: Award },
  { title: 'Leaderboard', url: '/dashboard/leaderboard', icon: Trophy },
  { title: 'Peer Reviews', url: '/dashboard/peer-reviews', icon: ClipboardCheck },
  { title: 'Attendance', url: '/dashboard/attendance', icon: CalendarCheck },
  { title: 'Transcript', url: '/dashboard/transcript', icon: GraduationCap },
  { title: 'Group Projects', url: '/dashboard/group-projects', icon: FolderKanban },
  { title: 'Analytics', url: '/dashboard/analytics', icon: BarChart3 },
  { title: 'Invoices', url: '/dashboard/invoices', icon: FileText },
  { title: 'Referrals', url: '/dashboard/referrals', icon: Users },
  { title: 'Forum', url: '/forum', icon: MessageSquare },
  { title: 'Notifications', url: '/dashboard/notifications', icon: Bell },
  { title: 'Wallet', url: '/dashboard/wallet', icon: Wallet },
  { title: 'Settings', url: '/dashboard/settings', icon: Settings },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { signOut, profile } = useAuth();

  const isActive = (path: string) =>
    path === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <div className="p-4 border-b">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-heading font-bold text-lg">
                {profile?.full_name?.[0]?.toUpperCase() || 'S'}
              </div>
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
