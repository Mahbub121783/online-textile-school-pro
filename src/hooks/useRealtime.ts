import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { shouldSkipRealtime } from '@/lib/maintenanceMode';

/**
 * EMERGENCY MODE: realtime subscriptions trimmed to the bare minimum
 * to stop self-inflicted query storms while the Supabase instance is
 * recovering from saturation.
 *
 * All admin / instructor / student layouts only subscribe to a single
 * notifications INSERT channel. Tab data is refetched on mount or via
 * mutations instead of being live-invalidated by every DB change.
 */
function useNotificationsRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (shouldSkipRealtime) return;
    const channel = supabase
      .channel(`notifications-broadcast-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);
}

export function useAdminRealtime() {
  useNotificationsRealtime();
}

export function useInstructorRealtime() {
  useNotificationsRealtime();
}

export function useStudentRealtime() {
  useNotificationsRealtime();
}
