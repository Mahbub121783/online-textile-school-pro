import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSiteContent(pageKey: string) {
  return useQuery({
    queryKey: ['site-content', pageKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('site_content')
        .select('section_key, content')
        .eq('page_key', pageKey);
      const map: Record<string, any> = {};
      (data ?? []).forEach((row) => {
        map[row.section_key] = row.content;
      });
      return map;
    },
    // Was 10min -- CMS content an admin just edited in AdminSiteContent.tsx
    // should show up for visitors (and the admin's own other tabs) sooner
    // than that. refetchOnMount/WindowFocus are inherited from the
    // QueryClient defaults (App.tsx), so this now only bounds how often an
    // already-mounted, still-focused page re-polls.
    staleTime: 2 * 60 * 1000,
  });
}
