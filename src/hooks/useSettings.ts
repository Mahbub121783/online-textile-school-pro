import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const LS_KEY = 'ots-site-settings-cache';

const readCache = (): Record<string, string> | null => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const writeCache = (data: Record<string, string>) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* quota */ }
};

export function useSettings() {
  return useQuery({
    queryKey: ['site-settings'],
    initialData: () => readCache() ?? undefined,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('key, value');
        if (error) throw error;
        const map: Record<string, string> = {};
        data?.forEach((s: any) => { map[s.key] = s.value ?? ''; });
        writeCache(map);
        return map;
      } catch (err) {
        const cached = readCache();
        if (cached) return cached;
        throw err;
      }
    },
    staleTime: 60 * 60 * 1000,   // 1h — site settings change rarely
    gcTime: 2 * 60 * 60 * 1000,
    retry: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useSetting(key: string) {
  const { data } = useSettings();
  return data?.[key] ?? '';
}
