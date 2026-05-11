import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useExamHeartbeat(sessionId: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!sessionId || !enabled) return;
    const ping = () => {
      supabase.rpc('qb_heartbeat', { _session_id: sessionId }).then(() => {});
    };
    ping();
    const iv = setInterval(ping, 20000);
    return () => clearInterval(iv);
  }, [sessionId, enabled]);
}
