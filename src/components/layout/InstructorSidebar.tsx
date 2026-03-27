import { BookOpen, LayoutDashboard, PlusCircle, FileQuestion, ClipboardList, DollarSign, Settings, LogOut, GraduationCap, Wallet, Bell, FileText, Award } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation, useNavigate } from 'react-router-dom';
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
  { title: 'Dashboard', url: '/instructor', icon: LayoutDashboard },
  { title: 'My Courses', url: '/instructor/courses', icon: BookOpen },
  { title: 'Create Course', url: '/instructor/courses/new', icon: PlusCircle },
  { title: 'Lessons', url: '/instructor/lessons', icon: FileText },
  { title: 'Quizzes', url: '/instructor/quizzes', icon: FileQuestion },
  { title: 'Assignments', url: '/instructor/assignments', icon: ClipboardList },
  { title: 'Gradebook', url: '/instructor/gradebook', icon: GraduationCap },
  { title: 'Certificates', url: '/instructor/certificates', icon: Award },
  { title: 'Revenue', url: '/instructor/revenue', icon: DollarSign },
  { title: 'Wallet', url: '/instructor/wallet', icon: Wallet },
  { title: 'Students', url: '/instructor/students', icon: GraduationCap },
  { title: 'Notifications', url: '/instructor/notifications', icon: Bell },
];

export function InstructorSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <div className="p-4 border-b">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-heading font-bold text-lg">
                {profile?.full_name?.[0]?.toUpperCase() || 'I'}
              </div>
              <p className="mt-2 font-heading font-semibold text-sm truncate">{profile?.full_name || 'Instructor'}</p>
              <p className="text-xs text-muted-foreground">Instructor Portal</p>
            </div>
          )}
          <SidebarGroupLabel>Instructor</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/instructor'}
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
      <SidebarFooter className="p-2 space-y-1">
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => navigate('/dashboard')}>
          <LayoutDashboard className="h-4 w-4 mr-2" />
          {!collapsed && 'Student Dashboard'}
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start text-destructive" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && 'Sign Out'}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
