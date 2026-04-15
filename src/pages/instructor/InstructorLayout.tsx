import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { InstructorSidebar } from '@/components/layout/InstructorSidebar';
import { useInstructorRealtime } from '@/hooks/useRealtime';
import NotificationBell from '@/components/layout/NotificationBell';
import ErrorBoundary from '@/components/ErrorBoundary';

const InstructorLayout = () => {
  const { user, roles, loading } = useAuth();
  const location = useLocation();
  useInstructorRealtime();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/login?redirect=/instructor" replace />;

  const isInstructor = roles.includes('instructor') || roles.includes('admin') || roles.includes('super_admin');
  if (!isInstructor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <h2 className="font-heading text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You need an instructor role to access this portal.</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <InstructorSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b px-4 bg-background sticky top-0 z-40">
            <SidebarTrigger className="mr-3" />
            <h1 className="font-heading font-bold text-lg text-foreground flex-1">Instructor Portal</h1>
            <NotificationBell basePath="/instructor" />
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <ErrorBoundary key={location.pathname}>
              <div className="animate-in fade-in duration-200">
                <Outlet />
              </div>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default InstructorLayout;
