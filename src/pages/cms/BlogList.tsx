import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import SEOHead from '@/components/SEOHead';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { Badge } from '@/components/ui/badge';
import { Calendar, User } from 'lucide-react';
import { format } from 'date-fns';

const BlogList = () => {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog-posts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('posts')
        .select('*, user_profiles!posts_author_id_fkey(full_name)')
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title="Blog" description="Read the latest articles about textile engineering, industry news, and learning tips." />
      <UtilityBar />
      <Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="bg-secondary py-6">
          <div className="container">
            <h1 className="font-heading text-3xl font-bold">Blog</h1>
            <p className="text-muted-foreground mt-1">Latest articles & industry insights</p>
          </div>
        </div>
        <div className="container py-8">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">No blog posts yet. Check back soon!</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post: any) => (
                <Link key={post.id} to={`/blog/${post.slug}`} className="group">
                  <article className="bg-card border rounded-xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1">
                    {post.featured_image_url ? (
                      <img src={post.featured_image_url} alt={post.title} className="w-full aspect-video object-cover" />
                    ) : (
                      <div className="w-full aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                        <span className="text-4xl opacity-30">📝</span>
                      </div>
                    )}
                    <div className="p-5 space-y-3">
                      {post.category && <Badge variant="secondary" className="text-xs">{post.category}</Badge>}
                      <h2 className="font-heading font-bold text-lg line-clamp-2 group-hover:text-primary transition-colors">{post.title}</h2>
                      {post.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{post.published_at ? format(new Date(post.published_at), 'dd MMM yyyy') : '—'}</span>
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{(post.user_profiles as any)?.full_name || 'Admin'}</span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default BlogList;
