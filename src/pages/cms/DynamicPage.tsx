import { PageSkeleton } from '@/components/ui/loading-skeletons';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import SEOHead from '@/components/SEOHead';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import BlockRenderer from '@/components/cms/BlockRenderer';

const DynamicPage = () => {
  const { slug } = useParams();

  const { data: page, isLoading, error } = useQuery({
    queryKey: ['page', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .eq('slug', slug!)
        .eq('status', 'published')
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <UtilityBar /><Header />
        <main className="flex-1 flex items-center justify-center">
          <PageSkeleton />
        </main>
        <Footer /><BottomNav />
      </div>
    );
  }

  if (!isLoading && (error || !page)) {
    const appRoutes = ['courses', 'ebooks', 'cart', 'checkout', 'auth', 'dashboard', 'instructor', 'admin', 'learn', 'quiz', 'assignment', 'payment', 'blog', 'profile', 'reset-password'];
    if (slug && appRoutes.includes(slug.split('/')[0])) return null;
    return (
      <div className="min-h-screen flex flex-col">
        <UtilityBar /><Header />
        <main className="flex-1 flex items-center justify-center pb-14 lg:pb-0">
          <div className="text-center py-16">
            <h2 className="font-heading text-3xl font-bold mb-2">Page Not Found</h2>
            <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
          </div>
        </main>
        <Footer /><BottomNav />
      </div>
    );
  }

  const blocks = Array.isArray(page.content) ? page.content : [];

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title={page.meta_title || page.title}
        description={page.meta_description || ''}
      />
      <UtilityBar />
      <Header />
      <main className="flex-1 pb-14 lg:pb-0">
        {page.template === 'landing' ? (
          <BlockRenderer blocks={blocks as any} />
        ) : (
          <div className="container py-8 max-w-4xl">
            <h1 className="font-heading text-3xl md:text-4xl font-bold mb-8">{page.title}</h1>
            <BlockRenderer blocks={blocks as any} />
          </div>
        )}
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default DynamicPage;
