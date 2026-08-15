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
    // Was 1h with all refetch triggers off -- an admin changing a site
    // setting (banner text, contact info, feature toggle...) wouldn't see
    // it reflected anywhere, including their own other tabs, for up to an
    // hour. 3 minutes is still a meaningful cache (this hook is used
    // platform-wide) while keeping edits visible in a reasonable time.
    staleTime: 3 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    retry: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useSetting(key: string) {
  const { data } = useSettings();
  return data?.[key] ?? '';
}
