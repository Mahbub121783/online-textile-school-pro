import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Sends a lightweight heartbeat RPC so server-side knows the exam tab is alive.
 *
 * Free-tier hardening:
 *  - Interval 180s (3 min) — only purpose is orphan-session cleanup (15-min threshold)
 *  - Skips entirely when tab is hidden (no writes from background tabs)
 *  - 500 concurrent users × 30-min exam = ~5K writes instead of 15K.
 */
export function useExamHeartbeat(sessionId: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!sessionId || !enabled) return;

    const ping = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      supabase.rpc('qb_heartbeat', { _session_id: sessionId }).then(() => {});
    };

    ping();
    const iv = setInterval(ping, 180_000);
    return () => clearInterval(iv);
  }, [sessionId, enabled]);
}
