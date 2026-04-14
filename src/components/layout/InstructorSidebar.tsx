import { BookOpen, LayoutDashboard, PlusCircle, FileQuestion, ClipboardList, DollarSign, LogOut, GraduationCap, Wallet, Bell, FileText, Award, MessageSquare, Megaphone, BarChart3, Users, FlaskConical, Briefcase, ShieldAlert } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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
import { Badge } from '@/components/ui/badge';

const navGroups = [
  {
    label: 'Teaching',
    items: [
      { title: 'Dashboard', url: '/instructor', icon: LayoutDashboard, end: true },
      { title: 'My Courses', url: '/instructor/courses', icon: BookOpen },
      { title: 'Create Course', url: '/instructor/courses/new', icon: PlusCircle },
      { title: 'Lessons', url: '/instructor/lessons', icon: FileText },
      { title: 'Quizzes', url: '/instructor/quizzes', icon: FileQuestion },
      { title: 'Assignments', url: '/instructor/assignments', icon: ClipboardList },
      { title: 'Certificates', url: '/instructor/certificates', icon: Award },
    ],
  },
  {
    label: 'Students',
    items: [
      { title: 'Students', url: '/instructor/students', icon: Users },
      { title: 'Gradebook', url: '/instructor/gradebook', icon: GraduationCap },
      { title: 'Plagiarism', url: '/instructor/plagiarism', icon: ShieldAlert },
      { title: 'Discussions', url: '/instructor/discussions', icon: MessageSquare, badgeKey: 'discussions' },
      { title: 'Announcements', url: '/instructor/announcements', icon: Megaphone },
      { title: 'Analytics', url: '/instructor/analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Community',
    items: [
      { title: 'Blog Posts', url: '/instructor/posts', icon: FileText },
      { title: 'Forum', url: '/forum', icon: MessageSquare },
      { title: 'Research', url: '/instructor/research', icon: FlaskConical },
      { title: 'Internships', url: '/instructor/internships', icon: Briefcase },
    ],
  },
  {
    label: 'Finance',
    items: [
      { title: 'Revenue', url: '/instructor/revenue', icon: DollarSign },
      { title: 'Wallet', url: '/instructor/wallet', icon: Wallet },
    ],
  },
];

export function InstructorSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const navigate = useNavigate();
  const { signOut, profile, user } = useAuth();

  // Badge counts
  const { data: badgeCounts = { discussions: 0, submissions: 0 } } = useQuery({
    queryKey: ['instructor-badge-counts', user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Unanswered discussions
      const { data: courses } = await supabase.from('courses').select('id').eq('instructor_id', user!.id);
      const courseIds = (courses ?? []).map((c: any) => c.id);
      let discussions = 0;
      if (courseIds.length > 0) {
        const { count } = await supabase.from('discussions')
          .select('id', { count: 'exact', head: true })
          .in('course_id', courseIds)
          .is('parent_id', null)
          .eq('is_answered', false);
        discussions = count || 0;
      }
      return { discussions, submissions: 0 };
    },
    refetchInterval: 60000,
  });

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        {!collapsed && (
          <div className="p-4 border-b">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-heading font-bold text-lg">
              {profile?.full_name?.[0]?.toUpperCase() || 'I'}
            </div>
            <p className="mt-2 font-heading font-semibold text-sm truncate">{profile?.full_name || 'Instructor'}</p>
            <p className="text-xs text-muted-foreground">Instructor Portal</p>
          </div>
        )}

        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const badgeCount = (item as any).badgeKey === 'discussions' ? badgeCounts.discussions : 0;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={(item as any).end}
                          className="hover:bg-muted/50"
                          activeClassName="bg-muted text-primary font-medium"
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {!collapsed && <span className="flex-1">{item.title}</span>}
                          {!collapsed && badgeCount > 0 && (
                            <Badge variant="destructive" className="ml-auto h-5 min-w-5 text-[10px] px-1.5 justify-center">
                              {badgeCount}
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-2 space-y-1">
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => navigate('/instructor/notifications')}>
          <Bell className="h-4 w-4 mr-2" />
          {!collapsed && 'Notifications'}
        </Button>
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
