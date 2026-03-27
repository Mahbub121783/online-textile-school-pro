import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Library } from 'lucide-react';

const MyEbooks = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: purchasedEbooks = [], isLoading } = useQuery({
    queryKey: ['my-ebooks', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('item_id, orders!inner(user_id, status)')
        .eq('item_type', 'ebook')
        .eq('orders.user_id', user!.id)
        .eq('orders.status', 'completed');

      if (!orderItems?.length) return [];

      const ebookIds = orderItems.map((oi: any) => oi.item_id);
      const { data: ebooks } = await supabase
        .from('ebooks')
        .select('id, title, slug, author, cover_url, page_count')
        .in('id', ebookIds);
      return ebooks ?? [];
    },
  });

  const { data: progressMap = {} } = useQuery({
    queryKey: ['my-ebooks-progress', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('ebook_reading_progress')
        .select('ebook_id, current_page, total_pages, progress_pct')
        .eq('user_id', user!.id);
      const map: Record<string, { current_page: number; total_pages: number; progress_pct: number }> = {};
      (data ?? []).forEach((p: any) => { map[p.ebook_id] = p; });
      return map;
    },
  });

  if (isLoading) {
    return <div className="animate-pulse text-muted-foreground py-12 text-center">Loading eBooks...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">My eBooks</h2>
        <Button variant="outline" onClick={() => navigate('/ebooks')}>Browse eBooks</Button>
      </div>

      {purchasedEbooks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Library className="h-16 w-16 mx-auto mb-4 text-muted" />
          <h3 className="font-heading font-bold text-lg mb-2">No eBooks yet</h3>
          <p className="mb-4">Purchase an eBook to access it here.</p>
          <Button className="bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => navigate('/ebooks')}>
            Browse eBooks
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {purchasedEbooks.map((ebook: any) => {
            const progress = progressMap[ebook.id];
            const pct = progress?.progress_pct || 0;
            return (
              <div key={ebook.id} className="bg-card border rounded-xl overflow-hidden group hover:shadow-md transition-shadow">
                <div className="aspect-[3/4] relative overflow-hidden bg-muted">
                  <img
                    src={ebook.cover_url || '/placeholder.svg'}
                    alt={ebook.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-heading font-bold text-sm line-clamp-2 mb-1">{ebook.title}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{ebook.author}</p>
                  {progress && (
                    <div className="mb-2">
                      <Progress value={pct} className="h-1.5 mb-1" />
                      <p className="text-[10px] text-muted-foreground">
                        {pct > 0
                          ? `Resume from page ${progress.current_page} · ${pct}%`
                          : 'Not started'}
                      </p>
                    </div>
                  )}
                  <Button size="sm" className="w-full" onClick={() => navigate(`/read/${ebook.id}`)}>
                    {progress && pct > 0 ? 'Continue Reading' : 'Read Now'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyEbooks;
