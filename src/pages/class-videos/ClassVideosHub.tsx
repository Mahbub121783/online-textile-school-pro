import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useVideoCategories, useClassVideos } from '@/hooks/useClassVideos';
import VideoCard from '@/components/class-videos/VideoCard';
import CategoryCard from '@/components/class-videos/CategoryCard';
import SEOHead from '@/components/SEOHead';

export default function ClassVideosHub() {
  const [search, setSearch] = useState('');
  const { data: categories, isLoading: loadingCats } = useVideoCategories();
  const { data: featured } = useClassVideos({ featured: true, limit: 8 });
  const { data: results, isLoading: loadingResults } = useClassVideos({
    search: search.trim() || undefined,
    limit: 24,
    sort: 'newest',
  });

  return (
    <>
      <SEOHead
        title="Class Videos — Free Video Library"
        description="Free category-wise class videos: Spinning, Dyeing, Weaving and more textile subjects with searchable library."
      />

      <div className="container py-8 md:py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-heading font-bold mb-3">Class Videos</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Free educational videos organized by subject. Watch, learn, comment, and discuss.
          </p>
        </div>

        <div className="max-w-2xl mx-auto mb-10 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search videos by topic, title, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 h-12 text-base"
          />
        </div>

        {!search && (
          <>
            {featured && featured.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="text-xl md:text-2xl font-heading font-bold">Featured Videos</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {featured.map((v) => <VideoCard key={v.id} video={v} />)}
                </div>
              </section>
            )}

            <section className="mb-12">
              <h2 className="text-xl md:text-2xl font-heading font-bold mb-4">Browse by Subject</h2>
              {loadingCats ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[16/10]" />)}
                </div>
              ) : !categories || categories.length === 0 ? (
                <p className="text-muted-foreground text-sm">No categories yet.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {categories.map((c) => <CategoryCard key={c.id} category={c} />)}
                </div>
              )}
            </section>
          </>
        )}

        {search && (
          <section>
            <h2 className="text-xl font-bold mb-4">Search results</h2>
            {loadingResults ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-video" />)}
              </div>
            ) : !results || results.length === 0 ? (
              <p className="text-muted-foreground text-sm py-12 text-center">
                No videos match "{search}". Try a different keyword.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {results.map((v) => <VideoCard key={v.id} video={v} />)}
              </div>
            )}
          </section>
        )}

        {!search && (
          <section>
            <h2 className="text-xl md:text-2xl font-heading font-bold mb-4">Latest Videos</h2>
            {loadingResults ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-video" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {results?.map((v) => <VideoCard key={v.id} video={v} />)}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
