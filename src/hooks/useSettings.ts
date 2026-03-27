import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSettings() {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('site_settings').select('*');
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.key] = s.value ?? ''; });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetting(key: string) {
  const { data } = useSettings();
  return data?.[key] ?? '';
}
