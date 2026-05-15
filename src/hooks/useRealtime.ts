import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { shouldSkipRealtime } from '@/lib/maintenanceMode';

/**
 * EMERGENCY MODE: realtime subscriptions trimmed to the bare minimum
 * to stop self-inflicted query storms while the Supabase instance is
 * recovering from saturation.
 *
 * Subscribes only to the current user's notifications inserts (filter
 * by user_id) so OTHER users' notifications don't invalidate caches
 * across every connected client (previous behavior caused cascade
 * refetches under load).
 */
function useNotificationsRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  useEffect(() => {
    if (shouldSkipRealtime || !user?.id) return;
    const uid = user.id;
    const channel = supabase
      .channel(`notifications-user-${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', uid] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, user?.id]);
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
