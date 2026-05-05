import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSettings() {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      // Only select the columns SEO/UI actually needs to keep payload small.
      const { data } = await supabase
        .from('site_settings')
        .select('key, value');
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.key] = s.value ?? ''; });
      return map;
    },
    staleTime: 30 * 60 * 1000,   // 30 min — site settings change rarely
    gcTime: 60 * 60 * 1000,
    retry: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useSetting(key: string) {
  const { data } = useSettings();
  return data?.[key] ?? '';
}
