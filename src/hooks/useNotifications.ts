import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { shouldSkipHeavyQueries } from '@/lib/maintenanceMode';

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

// 60s polling stays as a fallback safety net (SSE connections can drop), but
// useAuth.tsx's SSE effect pushes an 'ots:notification' window event the
// instant a new row is inserted (see backend/src/realtime.js + db/49's
// notify_realtime_new_notification trigger), so in practice this is now
// near-instant rather than "up to 60s" -- this was previously polling-only
// because it ran on Supabase's free-tier realtime-channel cap; now that this
// is a self-hosted stack we own outright, that constraint no longer applies.
const NOTIFICATIONS_POLL_MS = 60_000;

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const onPush = () => queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
    window.addEventListener('ots:notification', onPush);
    return () => window.removeEventListener('ots:notification', onPush);
  }, [user?.id, queryClient]);

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications', user?.id],
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchInterval: NOTIFICATIONS_POLL_MS,
    refetchIntervalInBackground: false, // pause polling on hidden tabs
    refetchOnWindowFocus: true,         // catch up immediately when user returns
    refetchOnReconnect: true,
    retry: 0,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('notifications' as any)
        .select('id,user_id,type,title,message,link,is_read,metadata,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as Notification[];
    },
    enabled: !!user && !shouldSkipHeavyQueries,
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

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
