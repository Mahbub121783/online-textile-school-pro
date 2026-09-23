import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';

// Live-updates AdminFabricLibrary.tsx's Inventory/Campuses tabs via the same
// admin-only SSE room built for System Controls (GET /realtime/admin --
// backend/src/realtime.js's clientsAdmin/broadcastAdmin), not the generic
// per-user or per-campus channels. Deliberately its own hook (not the
// useAdminRealtime() in useRealtime.ts, a dormant leftover from the old
// Supabase-realtime-quota era) so adopting it stays scoped to this one page.
export function useFabricAdminRealtime(enabled: boolean) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const token = (session as any)?.access_token;
    if (!token) return;

    const apiBase = import.meta.env.VITE_SUPABASE_URL || 'https://api.onlinetextileschool.com';
    const es = new EventSource(`${apiBase}/realtime/admin?token=${encodeURIComponent(token)}`);

    es.addEventListener('fabric_inventory_changed', () => {
      queryClient.invalidateQueries({ queryKey: ['fabric-hangers-admin'] });
      queryClient.invalidateQueries({ queryKey: ['fabric-ledger-admin'] });
    });
    es.addEventListener('fabric_admin_libraries_changed', () => {
      queryClient.invalidateQueries({ queryKey: ['fabric-libraries-admin'] });
    });

    return () => es.close();
  }, [enabled, (session as any)?.access_token, queryClient]);
}
