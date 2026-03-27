import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { useAdminRealtime } from '@/hooks/useRealtime';
import NotificationBell from '@/components/layout/NotificationBell';

const AdminLayout = () => {
  const { user, roles, loading } = useAuth();
  useAdminRealtime();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/login?redirect=/admin" replace />;

  const isAdmin = roles.includes('admin') || roles.includes('super_admin');
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <h2 className="font-heading text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You need an admin role to access this panel.</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b px-4 bg-background sticky top-0 z-40">
            <SidebarTrigger className="mr-3" />
            <h1 className="font-heading font-bold text-lg text-foreground flex-1">Admin Panel</h1>
            <NotificationBell basePath="/admin" />
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <div className="animate-in fade-in duration-200">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
