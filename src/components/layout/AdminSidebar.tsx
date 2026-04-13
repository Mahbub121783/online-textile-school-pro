import { LayoutDashboard, Users, BookOpen, Image, Activity, LogOut, GraduationCap, Tag, Wallet, FileText, PenTool, ImageIcon, Menu, Palette, Video, HelpCircle, ClipboardList, Award, Settings, ChevronDown, BarChart3, UserCog, CheckSquare, DollarSign, Shield, MessageSquare, Wrench, Mail, CreditCard, ReceiptText, Cloud, Bell, ShoppingCart, HardDrive, Crown, Server, ClipboardEdit, Send, Calendar, Layers } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem,
  SidebarMenuSubButton, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const topItems = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Users', url: '/admin/users', icon: Users },
  { title: 'Students', url: '/admin/students', icon: GraduationCap },
];

const instructorSubItems = [
  { title: 'Approvals', url: '/admin/instructors', icon: CheckSquare },
  { title: 'Financials', url: '/admin/instructors/financials', icon: DollarSign },
  { title: 'Access Board', url: '/admin/instructors/access-board', icon: Shield },
  { title: 'Communications', url: '/admin/instructors/communications', icon: MessageSquare },
];

const cmsSubItems = [
  { title: 'Dashboard', url: '/admin/cms', icon: BarChart3 },
  { title: 'Courses', url: '/admin/cms/courses', icon: BookOpen },
  { title: 'Lessons', url: '/admin/cms/lessons', icon: Video },
  { title: 'Gradebook', url: '/admin/cms/gradebook', icon: GraduationCap },
  { title: 'Quizzes', url: '/admin/cms/quizzes', icon: HelpCircle },
  { title: 'Assignments', url: '/admin/cms/assignments', icon: ClipboardList },
  { title: 'Certificates', url: '/admin/cms/certificates', icon: Award },
  { title: 'Settings', url: '/admin/cms/settings', icon: Settings },
];

const setupSubItems = [
  { title: 'SMTP', url: '/admin/setup', icon: Mail },
  { title: 'Email Templates', url: '/admin/setup/email-templates', icon: FileText },
  { title: 'Email Logs', url: '/admin/setup/email-logs', icon: Activity },
  { title: 'Compose Email', url: '/admin/setup/compose-email', icon: Send },
  { title: 'Cloudinary', url: '/admin/setup/cloudinary', icon: Cloud },
  { title: 'Cloudflare R2', url: '/admin/setup/cloudflare-r2', icon: HardDrive },
  { title: 'ID Card Settings', url: '/admin/id-card-settings', icon: CreditCard },
  { title: 'ID Card Management', url: '/admin/id-card-management', icon: Shield },
];

const paymentSubItems = [
  { title: 'Dashboard', url: '/admin/payment', icon: BarChart3 },
  { title: 'Orders', url: '/admin/orders', icon: ShoppingCart },
  { title: 'Settings', url: '/admin/payment/settings', icon: Settings },
  { title: 'Refunds', url: '/admin/payment/refunds', icon: ReceiptText },
];

const academicSubItems = [
  { title: 'Batches', url: '/admin/batches', icon: Layers },
  { title: 'Academic Calendar', url: '/admin/academic-calendar', icon: Calendar },
  { title: 'Grade Config', url: '/admin/grade-config', icon: GraduationCap },
];

const bottomItems = [
  { title: 'E-Books', url: '/admin/ebooks', icon: BookOpen },
  { title: 'Learning Paths', url: '/admin/learning-paths', icon: GraduationCap },
  { title: 'Events', url: '/admin/events', icon: Activity },
  { title: 'Success Stories', url: '/admin/success-stories', icon: Users },
  { title: 'Coupons', url: '/admin/coupons', icon: Tag },
  { title: 'Pages', url: '/admin/pages', icon: FileText },
  { title: 'Blog Posts', url: '/admin/posts', icon: PenTool },
  { title: 'Site Content', url: '/admin/site-content', icon: ClipboardEdit },
  { title: 'Media', url: '/admin/media', icon: ImageIcon },
  { title: 'Menus', url: '/admin/menus', icon: Menu },
  { title: 'Appearance', url: '/admin/appearance', icon: Palette },
  { title: 'Hero Slides', url: '/admin/hero-slides', icon: Image },
  { title: 'Notifications', url: '/admin/notifications', icon: Bell },
  { title: 'Forum', url: '/admin/forum', icon: MessageSquare },
  { title: 'Activity Log', url: '/admin/activity', icon: Activity },
  { title: 'Registration', url: '/admin/registrations', icon: ClipboardEdit },
];

interface CollapsibleMenuProps {
  label: string;
  icon: React.ElementType;
  items: { title: string; url: string; icon: React.ElementType }[];
  basePath: string;
  collapsed: boolean;
  groupClass: string;
}

const CollapsibleMenu = ({ label, icon: Icon, items, basePath, collapsed, groupClass }: CollapsibleMenuProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname.startsWith(basePath);

  return (
    <Collapsible defaultOpen={isActive} className={groupClass}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            className={`hover:bg-muted/50 cursor-pointer ${isActive ? 'bg-muted text-primary font-medium' : ''}`}
            onClick={() => { if (!isActive) navigate(items[0].url); }}
          >
            <Icon className="mr-2 h-4 w-4" />
            {!collapsed && (
              <>
                <span className="flex-1">{label}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform group-data-[state=open]/${groupClass.split('/')[1]}:rotate-180`} />
              </>
            )}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        {!collapsed && (
          <CollapsibleContent>
            <SidebarMenuSub>
              {items.map(sub => (
                <SidebarMenuSubItem key={sub.title}>
                  <SidebarMenuSubButton asChild>
                    <NavLink to={sub.url} end={sub.url === basePath} className="hover:bg-muted/50 text-xs" activeClassName="bg-muted text-primary font-medium">
                      <sub.icon className="mr-2 h-3.5 w-3.5" />
                      <span>{sub.title}</span>
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        )}
      </SidebarMenuItem>
    </Collapsible>
  );
};

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const navigate = useNavigate();
  const { signOut, profile, isSuperAdmin, roles } = useAuth();

  const renderNavItem = (item: { title: string; url: string; icon: any }) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild>
        <NavLink to={item.url} end={item.url === '/admin'} className="hover:bg-muted/50" activeClassName="bg-muted text-primary font-medium">
          <item.icon className="mr-2 h-4 w-4" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <div className="p-4 border-b">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-heading font-bold text-lg ${isSuperAdmin ? 'bg-amber-500 text-white' : 'bg-primary text-primary-foreground'}`}>
                {isSuperAdmin ? <Crown className="h-5 w-5" /> : (profile?.full_name?.[0]?.toUpperCase() || 'A')}
              </div>
              <p className="mt-2 font-heading font-semibold text-sm truncate">{profile?.full_name || 'Admin'}</p>
              <Badge variant={isSuperAdmin ? 'default' : 'secondary'} className={`mt-1 text-[10px] ${isSuperAdmin ? 'bg-amber-500 hover:bg-amber-600' : ''}`}>
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </Badge>
            </div>
          )}
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {topItems.map(renderNavItem)}
              <CollapsibleMenu label="Instructor Mgmt" icon={UserCog} items={instructorSubItems} basePath="/admin/instructors" collapsed={collapsed} groupClass="group/collapsible-inst" />
              <CollapsibleMenu label="Academic" icon={GraduationCap} items={academicSubItems} basePath="/admin/batches" collapsed={collapsed} groupClass="group/collapsible-acad" />
              <CollapsibleMenu label="CMS" icon={BookOpen} items={cmsSubItems} basePath="/admin/cms" collapsed={collapsed} groupClass="group/collapsible-cms" />
              <CollapsibleMenu label="Setup" icon={Wrench} items={setupSubItems} basePath="/admin/setup" collapsed={collapsed} groupClass="group/collapsible-setup" />
              <CollapsibleMenu label="Payment" icon={CreditCard} items={paymentSubItems} basePath="/admin/payment" collapsed={collapsed} groupClass="group/collapsible-pay" />
              {bottomItems.map(renderNavItem)}
              {isSuperAdmin && (
                <>
                  <SidebarMenuItem>
                    <div className="px-3 pt-3 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">System</span>
                    </div>
                  </SidebarMenuItem>
                  {renderNavItem({ title: 'Admin Management', url: '/admin/admin-management', icon: Shield })}
                  {renderNavItem({ title: 'System Controls', url: '/admin/system-controls', icon: Server })}
                </>
              )}
              {renderNavItem({ title: 'Wallets', url: '/admin/wallets', icon: Wallet })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2 space-y-1">
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => navigate('/dashboard')}>
          <GraduationCap className="h-4 w-4 mr-2" />
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
