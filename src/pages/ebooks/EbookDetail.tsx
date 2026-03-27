import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/stores/cartStore';
import { Button } from '@/components/ui/button';
import { ShoppingCart, BookOpen, ArrowLeft, Clock, CheckCircle } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { toast } from '@/hooks/use-toast';

const EbookDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, items } = useCartStore();

  // Exclude file_url from client query — anti-piracy
  const { data: ebook, isLoading } = useQuery({
    queryKey: ['ebook', slug],
    queryFn: async () => {
      const { data } = await supabase
        .from('ebooks')
        .select('id, title, slug, description, author, cover_url, price, discount_price, page_count, is_published, category_id, tags, sub_writers, age_restriction, categories(name)')
        .eq('slug', slug!)
        .single();
      return data;
    },
    enabled: !!slug,
  });

  const { data: isPurchased } = useQuery({
    queryKey: ['ebook-purchased', ebook?.id, user?.id],
    enabled: !!ebook?.id && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('order_items')
        .select('id, orders!inner(user_id, status)')
        .eq('item_type', 'ebook')
        .eq('item_id', ebook!.id)
        .eq('orders.user_id', user!.id)
        .eq('orders.status', 'completed')
        .maybeSingle();
      return !!data;
    },
  });

  const { data: hasPendingOrder } = useQuery({
    queryKey: ['ebook-pending-order', ebook?.id, user?.id],
    enabled: !!ebook?.id && !!user && !isPurchased,
    queryFn: async () => {
      const { data } = await supabase
        .from('order_items')
        .select('id, orders!inner(user_id, status)')
        .eq('item_type', 'ebook')
        .eq('item_id', ebook!.id)
        .eq('orders.user_id', user!.id)
        .eq('orders.status', 'pending')
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
  });

  const handleReadNow = () => {
    if (!ebook) return;
    navigate(`/read/${ebook.id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <UtilityBar /><Header />
        <main className="flex-1 flex items-center justify-center"><div className="animate-pulse">Loading...</div></main>
        <Footer /><BottomNav />
      </div>
    );
  }

  if (!ebook) {
    return (
      <div className="min-h-screen flex flex-col">
        <UtilityBar /><Header />
        <main className="flex-1 flex items-center justify-center"><p>eBook not found.</p></main>
        <Footer /><BottomNav />
      </div>
    );
  }

  const price = ebook.discount_price ?? ebook.price;
  const inCart = items.some((i) => i.id === ebook.id);

  const handleAddToCart = () => {
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
        title={ebook?.title}
        description={ebook?.description?.slice(0, 155) || `${ebook?.title} — available as an eBook at Online Textile School.`}
        ogImage={ebook?.cover_url || undefined}
        jsonLd={ebook ? {
          '@context': 'https://schema.org',
          '@type': 'Book',
          name: ebook.title,
          author: ebook.author ? { '@type': 'Person', name: ebook.author } : undefined,
          description: ebook.description,
          image: ebook.cover_url,
          numberOfPages: ebook.page_count,
          offers: { '@type': 'Offer', price: price, priceCurrency: 'BDT', availability: 'https://schema.org/InStock' },
          publisher: { '@type': 'Organization', name: 'Online Textile School' },
        } : undefined}
      />
      <UtilityBar /><Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="container py-6">
          <Button variant="ghost" className="mb-4" onClick={() => navigate('/ebooks')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to eBooks
          </Button>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Cover */}
            <div className="w-full md:w-80 shrink-0">
              <div className="aspect-[3/4] bg-muted rounded-xl overflow-hidden">
                <img src={ebook.cover_url || '/placeholder.svg'} alt={ebook.title} className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 space-y-4">
              {ebook.categories?.name && (
                <span className="text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full font-medium">
                  {ebook.categories.name}
                </span>
              )}
              <h1 className="font-heading text-3xl font-bold">{ebook.title}</h1>
              {ebook.author && <p className="text-muted-foreground">by <span className="font-medium text-foreground">{ebook.author}</span></p>}
              {ebook.sub_writers && ebook.sub_writers.length > 0 && (
                <p className="text-sm text-muted-foreground">Co-authors: {ebook.sub_writers.join(', ')}</p>
              )}
              {ebook.page_count && <p className="text-sm text-muted-foreground">{ebook.page_count} pages</p>}

              {ebook.tags && ebook.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {ebook.tags.map((t: string) => (
                    <span key={t} className="text-xs bg-muted px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              )}

              {isPurchased ? (
                <>
                  <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full text-sm font-semibold">
                    <CheckCircle className="h-4 w-4" /> Purchased
                  </div>
                  <Button
                    size="lg"
                    className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2 font-semibold"
                    onClick={handleReadNow}
                  >
                    <BookOpen className="h-5 w-5" /> Read Now
                  </Button>
                </>
              ) : hasPendingOrder ? (
                <div className="space-y-2">
                  <Button size="lg" variant="secondary" disabled className="gap-2">
                    <Clock className="h-5 w-5" /> Order Pending Verification
                  </Button>
                  <p className="text-xs text-muted-foreground">Your purchase is being verified by admin.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="font-heading text-3xl font-bold text-primary">৳{price}</span>
                    {ebook.discount_price && (
                      <span className="text-lg text-muted-foreground line-through">৳{ebook.price}</span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      size="lg"
                      className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
                      onClick={handleAddToCart}
                      disabled={inCart}
                    >
                      <ShoppingCart className="h-5 w-5" />
                      {inCart ? 'In Cart' : 'Add to Cart'}
                    </Button>
                  </div>
                </>
              )}

              {ebook.description && (
                <div className="pt-4 border-t">
                  <h3 className="font-heading font-bold mb-2">Description</h3>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{ebook.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      {/* Fixed mobile action bar for purchased users */}
      {isPurchased && (
        <div className="fixed bottom-14 left-0 right-0 z-40 md:hidden bg-card border-t shadow-lg px-4 py-3">
          <Button
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold gap-2"
            onClick={handleReadNow}
          >
            <BookOpen className="h-4 w-4" /> Read Now
          </Button>
        </div>
      )}
      <Footer /><BottomNav />
    </div>
  );
};

export default EbookDetail;
