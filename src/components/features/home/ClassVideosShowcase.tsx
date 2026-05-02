import { Link } from 'react-router-dom';
import { ArrowRight, PlaySquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useClassVideos } from '@/hooks/useClassVideos';
import VideoCard from '@/components/class-videos/VideoCard';

export default function ClassVideosShowcase() {
  const { data: videos, isLoading } = useClassVideos({ limit: 8, sort: 'newest' });

  if (!isLoading && (!videos || videos.length === 0)) return null;

  return (
    <section className="py-12 md:py-16 bg-gradient-to-b from-background to-muted/20">
      <div className="container">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-primary text-sm font-semibold mb-1">
              <PlaySquare className="h-4 w-4" /> FREE LIBRARY
            </div>
            <h2 className="text-2xl md:text-4xl font-heading font-bold">Class Videos</h2>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Watch free educational videos by subject. Comment, like, and discuss.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/class-videos" className="gap-1">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-[3/4] sm:aspect-video shrink-0 w-[45%] sm:w-auto snap-start" />
            ))}
          </div>
        ) : (
          <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scrollbar-hide">
            {videos!.slice(0, 8).map((v) => (
              <div key={v.id} className="shrink-0 w-[45%] sm:w-auto snap-start">
                <VideoCard video={v} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
