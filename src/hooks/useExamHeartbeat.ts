import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Sends a lightweight heartbeat RPC so server-side knows the exam tab is alive.
 *
 * Free-tier hardening:
 *  - Interval bumped from 20s → 60s (3× fewer writes)
 *  - Only pings when the tab is actually visible (no writes from background tabs)
 */
export function useExamHeartbeat(sessionId: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!sessionId || !enabled) return;

    const ping = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      supabase.rpc('qb_heartbeat', { _session_id: sessionId }).then(() => {});
    };

    ping();
    const iv = setInterval(ping, 60_000);
    return () => clearInterval(iv);
  }, [sessionId, enabled]);
}
