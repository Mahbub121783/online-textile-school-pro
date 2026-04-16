import { Link } from 'react-router-dom';
import { Star, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCartStore } from '@/stores/cartStore';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const EbookShowcase = () => {
  const addItem = useCartStore((s) => s.addItem);

  const { data: ebooks = [], isLoading } = useQuery({
    queryKey: ['home-ebooks'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ebooks')
        .select('id, title, slug, author, cover_url, price, discount_price, download_count, created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(4);
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });

  if (!isLoading && ebooks.length === 0) return null;

  return (
    <section className="py-12 md:py-16 bg-secondary min-h-[400px]">
      <div className="container">
        <div className="text-center mb-8">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">eBook Library</h2>
          <p className="text-muted-foreground">Digital textbooks from textile industry experts</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {ebooks.map((book: any) => {
              const price = book.discount_price ?? book.price ?? 0;
              return (
                <div key={book.id} className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-all group">
                  <div className="aspect-[2/3] bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-4 relative overflow-hidden cursor-pointer" onClick={() => window.location.href = `/ebooks/${book.slug}`}>
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform" loading="lazy" />
                    ) : (
                      <div className="text-center text-primary-foreground">
                        <span className="text-3xl mb-2 block">📚</span>
                        <p className="font-heading font-semibold text-sm leading-tight">{book.title}</p>
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <h3 className="font-heading font-semibold text-sm line-clamp-1">{book.title}</h3>
                    <p className="text-xs text-muted-foreground">{book.author || 'Unknown'}</p>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <span className="font-heading font-bold text-sm">৳{price}</span>
                        {book.discount_price && (
                          <span className="text-xs text-muted-foreground line-through ml-1">৳{book.price}</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => addItem({ id: book.id, type: 'ebook', title: book.title, price: book.price || 0, discount_price: book.discount_price ?? undefined })}
                      >
                        <ShoppingCart className="h-3 w-3 mr-1" />Buy
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-center mt-8">
          <Button variant="outline" size="lg" asChild>
            <Link to="/ebooks">View All eBooks →</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default EbookShowcase;
