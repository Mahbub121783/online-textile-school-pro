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
    staleTime: 10 * 60 * 1000,
  });
}
