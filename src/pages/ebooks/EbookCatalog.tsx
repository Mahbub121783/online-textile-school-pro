import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/stores/cartStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Search, BookOpen, CheckCircle, LayoutGrid, List, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { useWishlist } from '@/hooks/useWishlist';
import { toast } from '@/hooks/use-toast';

const ITEMS_PER_PAGE = 12;

const EbookCatalog = () => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, items } = useCartStore();
  const { wishlistIds, toggleWishlist } = useWishlist();

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
        .select('id, title, slug, author, cover_url, price, discount_price, page_count, category_id, tags, download_count, categories(name)')
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: purchasedEbookIds = new Set<string>() } = useQuery({
    queryKey: ['purchased-ebooks-set', user?.id],
    enabled: !!user,
    queryFn: async () => {
      // See MyEbooks.tsx -- the REST layer doesn't support filtering on an
      // embedded relation's columns (orders.user_id/status here), so this
      // always 400'd silently. Two plain queries instead.
      const { data: orders } = await supabase.from('orders').select('id').eq('user_id', user!.id).eq('status', 'completed');
      if (!orders?.length) return new Set<string>();
      const { data } = await supabase
        .from('order_items')
        .select('item_id')
        .eq('item_type', 'ebook')
        .in('order_id', orders.map((o: any) => o.id));
      return new Set((data ?? []).map((d: any) => d.item_id));
    },
  });

  const filtered = useMemo(() => {
    let result = ebooks.filter((eb: any) => {
      const matchesSearch = eb.title.toLowerCase().includes(search.toLowerCase()) ||
        eb.author?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || eb.category_id === Number(selectedCategory);
      return matchesSearch && matchesCategory;
    });

    // Sort
    result = [...result].sort((a: any, b: any) => {
      switch (sortBy) {
        case 'price_low': return (a.discount_price ?? a.price ?? 0) - (b.discount_price ?? b.price ?? 0);
        case 'price_high': return (b.discount_price ?? b.price ?? 0) - (a.discount_price ?? a.price ?? 0);
        case 'popular': return (b.download_count ?? 0) - (a.download_count ?? 0);
        case 'title_az': return (a.title || '').localeCompare(b.title || '');
        default: return 0; // newest is default from query
      }
    });

    return result;
  }, [ebooks, search, selectedCategory, sortBy]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

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
        description="Browse textile engineering eBooks covering Spinning, Weaving, Dyeing, Quality Control, Merchandising and more. Download or read online."
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'eBooks', url: '/ebooks' },
        ]}
        jsonLd={{
          '@context': 'https://schema.org', '@type': 'CollectionPage',
          name: 'eBook Library — Online Textile School',
          description: 'Comprehensive textile engineering eBooks for students and professionals.',
          url: 'https://onlinetextileschool.com/ebooks',
          provider: { '@type': 'EducationalOrganization', name: 'Online Textile School', url: 'https://onlinetextileschool.com' },
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
          {/* Filters bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search eBooks..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" />
            </div>

            <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat: any) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="popular">Popular</SelectItem>
                <SelectItem value="price_low">Price: Low→High</SelectItem>
                <SelectItem value="price_high">Price: High→Low</SelectItem>
                <SelectItem value="title_az">Title: A→Z</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex border rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">{filtered.length} eBook{filtered.length !== 1 ? 's' : ''} found</p>

          {isLoading ? (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' : 'space-y-3'}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-muted animate-pulse rounded-xl aspect-[3/5]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted" />
              <p className="text-lg">No eBooks found.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {paginatedItems.map((ebook: any) => {
                const isPurchased = purchasedEbookIds instanceof Set && purchasedEbookIds.has(ebook.id);
                const inCart = items.some((i) => i.id === ebook.id);
                const price = ebook.discount_price ?? ebook.price;
                const isWished = wishlistIds instanceof Set && wishlistIds.has(ebook.id);
                return (
                  <div key={ebook.id} className="bg-card border rounded-xl overflow-hidden group hover:shadow-lg transition-shadow">
                    <div className="aspect-[3/4] relative overflow-hidden bg-muted cursor-pointer" onClick={() => navigate(`/ebooks/${ebook.slug}`)}>
                      <img src={ebook.cover_url || '/placeholder.svg'} alt={ebook.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                      {user && !isPurchased && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleWishlist(ebook.id); }}
                          className="absolute top-2 left-2 p-1.5 rounded-full bg-card/80 hover:bg-card transition-colors"
                        >
                          <Heart className={`h-3.5 w-3.5 ${isWished ? 'fill-destructive text-destructive' : 'text-muted-foreground'}`} />
                        </button>
                      )}
                      {isPurchased && (
                        <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Owned
                        </div>
                      )}
                      {!isPurchased && ebook.discount_price && (
                        <div className="absolute top-2 right-2 bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded-full font-bold">Sale</div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-heading font-bold text-sm line-clamp-2 mb-1 cursor-pointer hover:text-primary" onClick={() => navigate(`/ebooks/${ebook.slug}`)}>{ebook.title}</h3>
                      <p className="text-xs text-muted-foreground mb-2">{ebook.author}</p>
                      <div className="flex items-center justify-between">
                        {isPurchased ? (
                          <>
                            <span className="text-xs text-green-600 font-semibold">✓ Purchased</span>
                            <Button size="icon" className="h-8 w-8 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => navigate(`/read/${ebook.id}`)}>
                              <BookOpen className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <div>
                              <span className="font-heading font-bold text-sm">৳{price}</span>
                              {ebook.discount_price && <span className="text-xs text-muted-foreground line-through ml-1">৳{ebook.price}</span>}
                            </div>
                            <div className="flex gap-1">
                              <Button size="icon" variant={inCart ? 'secondary' : 'default'} className="h-8 w-8" onClick={() => !inCart && handleAddToCart(ebook)} disabled={inCart}>
                                <ShoppingCart className="h-3.5 w-3.5" />
                              </Button>
                              {!inCart && (
                                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => { handleAddToCart(ebook); navigate('/checkout'); }} title="Buy Now">
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List view */
            <div className="space-y-3">
              {paginatedItems.map((ebook: any) => {
                const isPurchased = purchasedEbookIds instanceof Set && purchasedEbookIds.has(ebook.id);
                const inCart = items.some((i) => i.id === ebook.id);
                const price = ebook.discount_price ?? ebook.price;
                return (
                  <div key={ebook.id} className="bg-card border rounded-xl p-3 flex gap-4 hover:shadow-md transition-shadow">
                    <div className="w-20 h-28 sm:w-24 sm:h-32 shrink-0 bg-muted rounded-lg overflow-hidden cursor-pointer" onClick={() => navigate(`/ebooks/${ebook.slug}`)}>
                      <img src={ebook.cover_url || '/placeholder.svg'} alt={ebook.title} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h3 className="font-heading font-bold text-sm sm:text-base line-clamp-1 cursor-pointer hover:text-primary" onClick={() => navigate(`/ebooks/${ebook.slug}`)}>{ebook.title}</h3>
                        <p className="text-xs text-muted-foreground">{ebook.author}</p>
                        {ebook.categories?.name && <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full mt-1 inline-block">{ebook.categories.name}</span>}
                        {ebook.page_count && <p className="text-[10px] text-muted-foreground mt-1">{ebook.page_count} pages</p>}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        {isPurchased ? (
                          <>
                            <span className="text-xs text-green-600 font-semibold">✓ Purchased</span>
                            <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => navigate(`/read/${ebook.id}`)}>
                              <BookOpen className="h-3.5 w-3.5 mr-1" /> Read
                            </Button>
                          </>
                        ) : (
                          <>
                            <div>
                              <span className="font-heading font-bold">৳{price}</span>
                              {ebook.discount_price && <span className="text-xs text-muted-foreground line-through ml-1">৳{ebook.price}</span>}
                            </div>
                            <Button size="sm" variant={inCart ? 'secondary' : 'default'} onClick={() => !inCart && handleAddToCart(ebook)} disabled={inCart}>
                              <ShoppingCart className="h-3.5 w-3.5 mr-1" /> {inCart ? 'In Cart' : 'Add'}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const pageNum = totalPages <= 5 ? i + 1 :
                  page <= 3 ? i + 1 :
                  page >= totalPages - 2 ? totalPages - 4 + i :
                  page - 2 + i;
                return (
                  <Button key={pageNum} size="sm" variant={page === pageNum ? 'default' : 'outline'} onClick={() => setPage(pageNum)} className="w-9">
                    {pageNum}
                  </Button>
                );
              })}
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </main>
      <Footer /><BottomNav />
    </div>
  );
};

export default EbookCatalog;
