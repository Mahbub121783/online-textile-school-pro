import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TokenStatus {
  daily_balance: number;
  paid_balance: number;
  last_refill_date: string;
  is_staff: boolean;
}

export const useTokenBalance = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['qb-token-status', user?.id],
    enabled: !!user,
    staleTime: 60 * 1000,
    retry: 0,
    queryFn: async (): Promise<TokenStatus | null> => {
      try {
        const { data, error } = await supabase.rpc('qb_get_token_status');
        if (error) throw error;
        return (data as unknown) as TokenStatus;
      } catch {
        return null;
      }
    },
  });
};
