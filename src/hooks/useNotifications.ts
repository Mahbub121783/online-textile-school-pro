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

// Phase 1 (Free Tier 200-channel cap): notifications use 60s polling instead of
// a persistent realtime channel. With 500 active users this means up to 500
// req/min spread across the polling pool (~8 req/s) and ZERO realtime channels
// for notifications, freeing the realtime quota for chat (the only feature that
// truly needs sub-second freshness).
const NOTIFICATIONS_POLL_MS = 60_000;

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
