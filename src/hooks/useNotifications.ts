import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { shouldSkipHeavyQueries, shouldSkipRealtime } from '@/lib/maintenanceMode';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

// Module-level realtime channel registry: ensures only ONE channel per user
// even when multiple components (Header desktop, Header mobile, layout bell, etc.)
// mount NotificationBell simultaneously.
const realtimeRefCount = new Map<string, { channel: any; count: number }>();

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications', user?.id],
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchInterval: shouldSkipHeavyQueries ? false : 10 * 60 * 1000, // 10 min in normal, off in maintenance
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('notifications' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as Notification[];
    },
    enabled: !!user && !shouldSkipHeavyQueries,
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Shared per-user realtime channel — refcounted so duplicate mounts don't spawn extra channels.
  useEffect(() => {
    if (!user?.id || shouldSkipRealtime) return;
    const uid = user.id;
    const existing = realtimeRefCount.get(uid);
    if (existing) {
      existing.count += 1;
    } else {
      const channel = supabase
        .channel(`notifications:${uid}:${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
          () => {
            queryClient.invalidateQueries({ queryKey: ['notifications', uid] });
          }
        )
        .subscribe();
      realtimeRefCount.set(uid, { channel, count: 1 });
    }

    return () => {
      const entry = realtimeRefCount.get(uid);
      if (!entry) return;
      entry.count -= 1;
      if (entry.count <= 0) {
        supabase.removeChannel(entry.channel);
        realtimeRefCount.delete(uid);
      }
    };
  }, [user?.id, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications' as any).update({ is_read: true }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase.from('notifications' as any).update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  });

  return { notifications, unreadCount, isLoading, markAsRead: markAsRead.mutate, markAllRead: markAllRead.mutate };
}
