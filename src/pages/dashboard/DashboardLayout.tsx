import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import BottomNav from '@/components/layout/BottomNav';
import { useStudentRealtime } from '@/hooks/useRealtime';
import NotificationBell from '@/components/layout/NotificationBell';
import ErrorBoundary from '@/components/ErrorBoundary';

const DashboardLayout = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  useStudentRealtime();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/login?redirect=/dashboard" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b px-4 bg-background sticky top-0 z-40">
            <SidebarTrigger className="mr-3" />
            <h1 className="font-heading font-bold text-lg text-foreground flex-1">Student Dashboard</h1>
            <NotificationBell basePath="/dashboard" />
          </header>
          <main className="flex-1 p-4 md:p-6 pb-20 lg:pb-6 overflow-auto">
            <ErrorBoundary key={location.pathname}>
              <div className="animate-in fade-in duration-200">
                <Outlet />
              </div>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <BottomNav />
    </SidebarProvider>
  );
};

export default DashboardLayout;
