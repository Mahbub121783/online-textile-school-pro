import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import SEOHead from '@/components/SEOHead';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import BlockRenderer from '@/components/cms/BlockRenderer';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';

const BlogPost = () => {
  const { slug } = useParams();

  const { data: post, isLoading } = useQuery({
    queryKey: ['blog-post', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data } = await supabase
        .from('posts')
        .select('*, user_profiles!posts_author_id_fkey(full_name, avatar_url)')
        .eq('slug', slug!)
        .eq('status', 'published')
        .single();
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <UtilityBar /><Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </main>
        <Footer /><BottomNav />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col">
        <UtilityBar /><Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-bold mb-2">Post not found</h2>
            <Link to="/blog" className="text-primary hover:underline">← Back to Blog</Link>
          </div>
        </main>
        <Footer /><BottomNav />
      </div>
    );
  }

  const blocks = Array.isArray(post.content) ? post.content : [];

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title={post.title}
        description={post.excerpt || post.title}
        ogImage={post.featured_image_url || undefined}
        article={{
          publishedTime: post.published_at || post.created_at,
          modifiedTime: post.updated_at,
          author: (post as any).user_profiles?.full_name || 'Online Textile School',
          tags: post.tags || [],
        }}
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Blog', url: '/blog' },
          { name: post.title, url: `/blog/${post.slug}` },
        ]}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt || '',
          image: post.featured_image_url || undefined,
          datePublished: post.published_at || post.created_at,
          dateModified: post.updated_at,
          author: { '@type': 'Person', name: (post as any).user_profiles?.full_name || 'Online Textile School' },
          publisher: { '@type': 'Organization', name: 'Online Textile School', url: 'https://onlinetextileschool.com' },
          mainEntityOfPage: `https://onlinetextileschool.com/blog/${post.slug}`,
        }}
      />
      <UtilityBar />
      <Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="container py-8 max-w-3xl">
          <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
            <ArrowLeft className="h-4 w-4" /> Back to Blog
          </Link>

          {post.featured_image_url && (
            <img src={post.featured_image_url} alt={post.title} className="w-full aspect-video object-cover rounded-xl mb-6" />
          )}

          <div className="space-y-4 mb-8">
            {post.category && <Badge variant="secondary">{post.category}</Badge>}
            <h1 className="font-heading text-3xl md:text-4xl font-bold">{post.title}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><User className="h-4 w-4" />{(post.user_profiles as any)?.full_name || 'Admin'}</span>
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{post.published_at ? format(new Date(post.published_at), 'dd MMMM yyyy') : '—'}</span>
            </div>
          </div>

          <BlockRenderer blocks={blocks as any} />
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default BlogPost;
