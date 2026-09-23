import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';

export interface SystemStats {
  tableCounts: Record<string, number>;
  totalRecords: number;
  connectedUsers: number;
  connectedAdmins: number;
  dbPool: { total: number; idle: number; waiting: number };
  process: { uptimeSeconds: number; memoryMb: number; nodeVersion: string };
  services: {
    smtpConfigured: boolean;
    pushConfigured: boolean;
    r2Configured: boolean;
    cloudinaryConfigured: boolean;
    googleOAuthConfigured: boolean;
  };
  maintenanceMode: boolean;
  maintenanceManualFlag: boolean;
  maintenanceScheduledStart: string | null;
  maintenanceScheduledEnd: string | null;
  timestamp: string;
}

// Powers System Controls' live-updating stats via backend/src/realtime.js's
// GET /realtime/admin -- a genuine server push (backend broadcasts every
// ~5s to connected admins, not a client-side poll), admin-only.
export function useAdminSystemStats(enabled: boolean) {
  const { session } = useAuth();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const token = (session as any)?.access_token;
    if (!token) return;

    const apiBase = import.meta.env.VITE_SUPABASE_URL || 'https://api.onlinetextileschool.com';
    const es = new EventSource(`${apiBase}/realtime/admin?token=${encodeURIComponent(token)}`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener('stats', (e: MessageEvent) => {
      try { setStats(JSON.parse(e.data)); } catch { /* ignore malformed event */ }
    });

    return () => {
      es.close();
      setConnected(false);
    };
  }, [enabled, (session as any)?.access_token]);

  return { stats, connected };
}
