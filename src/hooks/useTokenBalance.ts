import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TokenStatus {
  daily_balance: number;
  paid_balance: number;
  last_refill_date: string;
  is_flash_day: boolean;
  is_staff: boolean;
}

export const useTokenBalance = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['qb-token-status', user?.id],
    enabled: !!user,
    staleTime: 60 * 1000,
    // Was retry:0 with every error silently swallowed into `null` --
    // meaning any single transient RPC failure (a network blip, a momentary
    // auth hiccup) made the balance pill show "0" forever, indistinguishable
    // from a genuinely empty balance, with no way to recover short of a
    // lucky page reload. Retrying lets a transient failure self-heal.
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    queryFn: async (): Promise<TokenStatus> => {
      const { data, error } = await supabase.rpc('qb_get_token_status');
      if (error) throw error;
      return (data as unknown) as TokenStatus;
    },
  });
};
