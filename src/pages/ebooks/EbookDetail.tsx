import { useEffect } from 'react';
import { sanitizeRichHtml } from '@/lib/htmlSanitize';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/stores/cartStore';
import { Button } from '@/components/ui/button';
import { ShoppingCart, BookOpen, ArrowLeft, Clock, CheckCircle, Share2, ExternalLink } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { toast } from '@/hooks/use-toast';
import ContributorBadge from '@/components/shared/ContributorBadge';
import { useContributors } from '@/hooks/useContributors';

const EbookDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, items } = useCartStore();

  const { data: ebook, isLoading } = useQuery({
    queryKey: ['ebook', slug],
    retry: 0,
    queryFn: async () => {
      try {
        let { data } = await supabase
          .from('ebooks')
          .select('id, title, slug, description, author, cover_url, price, discount_price, page_count, is_published, category_id, tags, sub_writers, age_restriction, gallery_urls, categories(name)')
          .eq('slug', slug!)
          .maybeSingle();
        if (!data) {
          const res = await supabase
            .from('ebooks')
            .select('id, title, slug, description, author, cover_url, price, discount_price, page_count, is_published, category_id, tags, sub_writers, age_restriction, gallery_urls, categories(name)')
            .eq('id', slug!)
            .maybeSingle();
          data = res.data;
        }
        return data;
      } catch {
        return null;
      }
    },
    enabled: !!slug,
  });

  // Redirect UUID URLs to slug URLs
  useEffect(() => {
    if (ebook?.slug && slug !== ebook.slug) {
      navigate(`/ebooks/${ebook.slug}`, { replace: true });
    }
  }, [ebook?.slug, slug, navigate]);

  const { data: ebookContributors = [] } = useContributors('ebook', ebook?.id);

  const { data: isPurchased } = useQuery({
    queryKey: ['ebook-purchased', ebook?.id, user?.id],
    enabled: !!ebook?.id && !!user,
    retry: 0,
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from('order_items')
          .select('id, orders!inner(user_id, status)')
          .eq('item_type', 'ebook')
          .eq('item_id', ebook!.id)
          .eq('orders.user_id', user!.id)
          .eq('orders.status', 'completed')
          .limit(1);
        return (data?.length ?? 0) > 0;
      } catch {
        return false;
      }
    },
  });

  const { data: hasPendingOrder } = useQuery({
    queryKey: ['ebook-pending-order', ebook?.id, user?.id],
    enabled: !!ebook?.id && !!user && !isPurchased,
    retry: 0,
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from('order_items')
          .select('id, orders!inner(user_id, status)')
          .eq('item_type', 'ebook')
          .eq('item_id', ebook!.id)
          .eq('orders.user_id', user!.id)
          .eq('orders.status', 'pending')
          .limit(1);
        return (data?.length ?? 0) > 0;
      } catch {
        return false;
      }
    },
  });

  // Related ebooks (same category)
  const { data: relatedEbooks = [] } = useQuery({
    queryKey: ['related-ebooks', ebook?.category_id, ebook?.id],
    enabled: !!ebook?.category_id,
    retry: 0,
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from('ebooks')
          .select('id, title, slug, author, cover_url, price, discount_price')
          .eq('is_published', true)
          .eq('category_id', ebook!.category_id!)
          .neq('id', ebook!.id)
          .limit(4);
        return data ?? [];
      } catch {
        return [];
      }
    },
  });

  const handleReadNow = () => {
    if (!ebook) return;
    navigate(`/read/${ebook.id}`);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: ebook?.title, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied!', description: 'Share link has been copied to clipboard.' });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <UtilityBar /><Header />
        <main className="flex-1 pb-14 lg:pb-0">
          <div className="container py-6">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="w-full md:w-80 shrink-0">
                <div className="aspect-[3/4] bg-muted rounded-xl animate-pulse" />
              </div>
              <div className="flex-1 space-y-4">
                <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-5 w-1/3 bg-muted rounded animate-pulse" />
                <div className="h-10 w-40 bg-muted rounded animate-pulse" />
                <div className="space-y-2 pt-4">
                  <div className="h-4 w-full bg-muted rounded animate-pulse" />
                  <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-4/6 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </main>
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
        breadcrumbs={ebook ? [
          { name: 'Home', url: '/' },
          { name: 'eBooks', url: '/ebooks' },
          { name: ebook.title, url: `/ebooks/${ebook.slug}` },
        ] : undefined}
        jsonLd={ebook ? {
          '@context': 'https://schema.org', '@type': 'Book',
          name: ebook.title,
          url: `https://onlinetextileschool.com/ebooks/${ebook.slug}`,
          author: ebook.author ? { '@type': 'Person', name: ebook.author } : undefined,
          description: ebook.description,
          image: ebook.cover_url,
          numberOfPages: ebook.page_count,
          bookFormat: 'EBook',
          offers: { '@type': 'Offer', price: price, priceCurrency: 'BDT', availability: 'https://schema.org/InStock' },
          publisher: { '@type': 'Organization', name: 'Online Textile School', url: 'https://onlinetextileschool.com' },
        } : undefined}
      />
      <UtilityBar /><Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="container py-6">
          <Button variant="ghost" className="mb-4" onClick={() => navigate('/ebooks')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to eBooks
          </Button>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Cover + Gallery */}
            <div className="w-full md:w-80 shrink-0 space-y-3">
              <div className="aspect-[3/4] bg-muted rounded-xl overflow-hidden">
                <img src={ebook.cover_url || '/placeholder.svg'} alt={ebook.title} className="w-full h-full object-cover" />
              </div>
              {ebook.gallery_urls && ebook.gallery_urls.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {ebook.gallery_urls.slice(0, 4).map((url: string, i: number) => (
                    <div key={i} className="aspect-square bg-muted rounded-lg overflow-hidden">
                      <img src={url} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 space-y-4">
              {ebook.categories?.name && (
                <span className="text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full font-medium">
                  {ebook.categories.name}
                </span>
              )}
              <h1 className="font-heading text-2xl sm:text-3xl font-bold">{ebook.title}</h1>
              {ebook.author && <p className="text-muted-foreground">by <span className="font-medium text-foreground">{ebook.author}</span></p>}
              {ebook.sub_writers && ebook.sub_writers.length > 0 && (
                <p className="text-sm text-muted-foreground">Co-authors: {ebook.sub_writers.join(', ')}</p>
              )}
              {ebookContributors.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {ebookContributors.map(c => (
                    <ContributorBadge
                      key={c.id}
                      id={c.user_id}
                      name={c.user_profiles?.full_name}
                      avatarUrl={c.user_profiles?.avatar_url}
                      role={c.role}
                      size="sm"
                      showRole
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {ebook.page_count && <span>{ebook.page_count} pages</span>}
                {ebook.age_restriction && ebook.age_restriction !== 'none' && (
                  <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded text-xs font-medium">{ebook.age_restriction}</span>
                )}
              </div>

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
                  <div className="flex gap-3">
                    <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2 font-semibold" onClick={handleReadNow}>
                      <BookOpen className="h-5 w-5" /> Read Now
                    </Button>
                    <Button size="lg" variant="outline" onClick={handleShare}>
                      <Share2 className="h-4 w-4 mr-2" /> Share
                    </Button>
                  </div>
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
                    {ebook.discount_price && ebook.price && (
                      <span className="text-sm bg-accent/20 text-accent-foreground px-2 py-0.5 rounded font-medium">
                        {Math.round((1 - ebook.discount_price / ebook.price) * 100)}% OFF
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2" onClick={handleAddToCart} disabled={inCart}>
                      <ShoppingCart className="h-5 w-5" /> {inCart ? 'In Cart' : 'Add to Cart'}
                    </Button>
                    {(price ?? 0) > 0 && (
                      <Button size="lg" variant="secondary" className="gap-2" onClick={() => {
                        handleAddToCart();
                        navigate('/checkout');
                      }} disabled={inCart}>
                        Buy Now
                      </Button>
                    )}
                    <Button size="lg" variant="outline" onClick={handleShare}>
                      <Share2 className="h-4 w-4 mr-2" /> Share
                    </Button>
                  </div>
                </>
              )}

              {ebook.description && (
                <div className="pt-4 border-t">
                  <h3 className="font-heading font-bold mb-2">Description</h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(ebook.description) }} />
                </div>
              )}
            </div>
          </div>

          {/* Related eBooks */}
          {relatedEbooks.length > 0 && (
            <div className="mt-12 border-t pt-8">
              <h2 className="font-heading text-xl font-bold mb-4">Related eBooks</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {relatedEbooks.map((rel: any) => (
                  <div key={rel.id} className="bg-card border rounded-xl overflow-hidden group hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/ebooks/${rel.slug}`)}>
                    <div className="aspect-[3/4] bg-muted overflow-hidden">
                      <img src={rel.cover_url || '/placeholder.svg'} alt={rel.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    </div>
                    <div className="p-3">
                      <h3 className="font-heading font-bold text-sm line-clamp-2 mb-1">{rel.title}</h3>
                      <p className="text-xs text-muted-foreground">{rel.author}</p>
                      <p className="font-bold text-sm mt-1">৳{rel.discount_price ?? rel.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {isPurchased && (
        <div className="fixed bottom-14 left-0 right-0 z-40 md:hidden bg-card border-t shadow-lg px-4 py-3">
          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold gap-2" onClick={handleReadNow}>
            <BookOpen className="h-4 w-4" /> Read Now
          </Button>
        </div>
      )}
      <Footer /><BottomNav />
    </div>
  );
};

export default EbookDetail;
