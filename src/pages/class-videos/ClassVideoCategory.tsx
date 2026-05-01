import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, ChevronLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useClassVideos, useVideoCategories } from '@/hooks/useClassVideos';
import VideoCard from '@/components/class-videos/VideoCard';
import SEOHead from '@/components/SEOHead';

export default function ClassVideoCategory() {
  const { slug } = useParams<{ slug: string }>();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'popular'>('newest');

  const { data: cats } = useVideoCategories();
  const category = cats?.find((c) => c.slug === slug);

  const { data: videos, isLoading } = useClassVideos({ categorySlug: slug, sort, limit: 100 });

  const filtered = useMemo(() => {
    if (!videos) return [];
    const q = search.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((v) =>
      v.title.toLowerCase().includes(q) ||
      (v.description ?? '').toLowerCase().includes(q) ||
      v.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [videos, search]);

  return (
    <>
      <SEOHead
        title={`${category?.name || 'Class Videos'} — Free Video Library`}
        description={category?.description || 'Free class videos by subject'}
      />
      <div className="container py-8">
        <Link to="/class-videos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
          <ChevronLeft className="h-4 w-4" /> All categories
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl md:text-4xl font-heading font-bold">
            {category?.icon ? <span className="mr-2">{category.icon}</span> : null}
            {category?.name || 'Category'}
          </h1>
          {category?.description && (
            <p className="text-muted-foreground mt-2">{category.description}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search within this subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={sort === 'newest' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSort('newest')}
            >
              Newest
            </Button>
            <Button
              variant={sort === 'popular' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSort('popular')}
            >
              Popular
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="aspect-video" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No videos found.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((v) => <VideoCard key={v.id} video={v} />)}
          </div>
        )}
      </div>
    </>
  );
}
