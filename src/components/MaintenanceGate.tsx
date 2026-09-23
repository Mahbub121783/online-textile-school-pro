import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSetting } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { isMaintenanceActive } from '@/lib/maintenanceSchedule';
import { ServerCog } from 'lucide-react';

// The System Controls "Maintenance Mode" toggle (src/pages/admin/SystemControls.tsx)
// used to only write to site_settings.maintenance_mode -- nothing anywhere
// ever read that value back, so flipping it had zero real effect on what
// visitors saw. This is the actual enforcement: any non-admin visitor sees
// a maintenance page instead of the app while it's on; admins/super_admins
// pass through unaffected so they can keep managing the site.
const MaintenanceGate = ({ children }: { children: ReactNode }) => {
  const maintenanceMode = useSetting('maintenance_mode');
  const scheduledStart = useSetting('maintenance_scheduled_start');
  const scheduledEnd = useSetting('maintenance_scheduled_end');

  // Re-checked every 15s so an open tab crosses a scheduled start/auto-off
  // boundary on its own, without waiting for a settings refetch (the
  // settings themselves don't change at that moment -- only the clock does).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  const maintenance = isMaintenanceActive(
    { maintenance_mode: maintenanceMode, maintenance_scheduled_start: scheduledStart, maintenance_scheduled_end: scheduledEnd },
    now
  );
  const { isReady, isSuperAdmin, roles } = useAuth();
  const isAdmin = isSuperAdmin || roles.includes('admin');
  const { pathname } = useLocation();
  // An admin isn't "known admin" until AFTER logging in -- without this,
  // turning maintenance mode on would lock every admin out of /auth/login
  // itself, with no way back in.
  const isAuthRoute = pathname.startsWith('/auth');

  // Don't block on the brief window before auth state resolves -- avoids a
  // flash of the maintenance page for an admin who's actually allowed through.
  if (maintenance && isReady && !isAdmin && !isAuthRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary p-4">
        <div className="text-center max-w-md">
          <ServerCog className="h-14 w-14 mx-auto text-primary mb-4" />
          <h1 className="font-heading text-2xl font-bold mb-2">We'll be right back</h1>
          <p className="text-muted-foreground">
            The site is temporarily down for maintenance. Please check back shortly.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default MaintenanceGate;
