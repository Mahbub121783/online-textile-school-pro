import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/stores/cartStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Search, BookOpen, CheckCircle } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { toast } from '@/hooks/use-toast';

const EbookCatalog = () => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, items } = useCartStore();

  const { data: categories = [] } = useQuery({
    queryKey: ['ebook-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id, name').order('sort_order');
      return data ?? [];
    },
  });

  const { data: ebooks = [], isLoading } = useQuery({
    queryKey: ['ebooks'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ebooks')
        .select('id, title, slug, author, cover_url, price, discount_price, page_count, category_id, tags, categories(name)')
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  // Fetch purchased ebook IDs
  const { data: purchasedEbookIds = new Set<string>() } = useQuery({
    queryKey: ['purchased-ebooks-set', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('order_items')
        .select('item_id, orders!inner(user_id, status)')
        .eq('item_type', 'ebook')
        .eq('orders.user_id', user!.id)
        .eq('orders.status', 'completed');
      return new Set((data ?? []).map((d: any) => d.item_id));
    },
  });

  const filtered = ebooks.filter((eb: any) => {
    const matchesSearch = eb.title.toLowerCase().includes(search.toLowerCase()) ||
      eb.author?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || eb.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddToCart = (ebook: any) => {
    addItem({
      id: ebook.id,
      type: 'ebook',
      title: ebook.title,
      price: ebook.price || 0,
      discount_price: ebook.discount_price,
      thumbnail_url: ebook.cover_url,
      instructor_name: ebook.author,
    });
    toast({ title: 'Added to cart', description: ebook.title });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title="eBook Library"
        description="Browse textile engineering eBooks covering Spinning, Weaving, Dyeing, Quality Control, Merchandising and more. Download and learn at your own pace."
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'eBook Library — Online Textile School',
          description: 'Comprehensive textile engineering eBooks for students and professionals.',
          url: window.location.href,
          provider: { '@type': 'EducationalOrganization', name: 'Online Textile School' },
        }}
      />
      <UtilityBar /><Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="bg-secondary py-6">
          <div className="container">
            <h1 className="font-heading text-3xl font-bold text-foreground mb-2">eBook Library</h1>
            <p className="text-muted-foreground">Comprehensive textile engineering eBooks for students & professionals.</p>
          </div>
        </div>
        <div className="container py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search eBooks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <select
              value={selectedCategory ?? ''}
              onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}
              className="border rounded-md px-3 py-2 text-sm bg-background text-foreground"
            >
              <option value="">All Categories</option>
              {categories.map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-muted animate-pulse rounded-xl aspect-[3/5]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg">No eBooks found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map((ebook: any) => {
                const isPurchased = purchasedEbookIds instanceof Set && purchasedEbookIds.has(ebook.id);
                const inCart = items.some((i) => i.id === ebook.id);
                const price = ebook.discount_price ?? ebook.price;
                return (
                  <div key={ebook.id} className="bg-card border rounded-xl overflow-hidden group hover:shadow-lg transition-shadow">
                    <div
                      className="aspect-[3/4] relative overflow-hidden bg-muted cursor-pointer"
                      onClick={() => navigate(`/ebooks/${ebook.slug}`)}
                    >
                      <img
                        src={ebook.cover_url || '/placeholder.svg'}
                        alt={ebook.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      {isPurchased && (
                        <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Owned
                        </div>
                      )}
                      {!isPurchased && ebook.discount_price && (
                        <div className="absolute top-2 right-2 bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded-full font-bold">
                          Sale
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3
                        className="font-heading font-bold text-sm line-clamp-2 mb-1 cursor-pointer hover:text-primary"
                        onClick={() => navigate(`/ebooks/${ebook.slug}`)}
                      >
                        {ebook.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-2">{ebook.author}</p>
                      <div className="flex items-center justify-between">
                        {isPurchased ? (
                          <>
                            <span className="text-xs text-green-600 font-semibold">✓ Purchased</span>
                            <Button
                              size="icon"
                              className="h-8 w-8 bg-accent hover:bg-accent/90 text-accent-foreground"
                              onClick={() => navigate(`/read/${ebook.id}`)}
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <div>
                              <span className="font-heading font-bold text-sm">৳{price}</span>
                              {ebook.discount_price && (
                                <span className="text-xs text-muted-foreground line-through ml-1">৳{ebook.price}</span>
                              )}
                            </div>
                            <Button
                              size="icon"
                              variant={inCart ? 'secondary' : 'default'}
                              className="h-8 w-8"
                              onClick={() => !inCart && handleAddToCart(ebook)}
                              disabled={inCart}
                            >
                              <ShoppingCart className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer /><BottomNav />
    </div>
  );
};

export default EbookCatalog;
