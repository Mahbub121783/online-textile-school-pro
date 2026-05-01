import { useEffect, useRef } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Heart, Eye, Calendar, ChevronLeft, Lock, Users, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useClassVideo, useRelatedVideos, useTrackVideoView, useVideoLike } from '@/hooks/useClassVideos';
import { useAuth } from '@/hooks/useAuth';
import SecureMediaPlayer from '@/components/media/SecureMediaPlayer';
import CommentThread from '@/components/class-videos/CommentThread';
import VideoCard from '@/components/class-videos/VideoCard';
import SEOHead from '@/components/SEOHead';
import { formatDistanceToNow } from 'date-fns';

export default function ClassVideoWatch() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { data: video, isLoading } = useClassVideo(slug);
  const { data: related } = useRelatedVideos(video);
  const trackView = useTrackVideoView();
  const { isLiked, toggle } = useVideoLike(video?.id);
  const viewed = useRef(false);

  useEffect(() => {
    if (video?.id && !viewed.current) {
      viewed.current = true;
      trackView.mutate(video.id);
    }
  }, [video?.id, trackView]);

  if (isLoading) {
    return (
      <div className="container py-8 max-w-6xl">
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-8 w-2/3 mt-4" />
      </div>
    );
  }

  if (!video) return <Navigate to="/class-videos" replace />;

  const VisIcon = video.visibility === 'paid' ? Lock : video.visibility === 'logged_in' ? Users : Globe;

  return (
    <>
      <SEOHead
        title={`${video.title} — Class Videos`}
        description={video.description?.slice(0, 160) || `Watch ${video.title} on Online Textile School`}
        image={video.thumbnail_url || undefined}
      />

      <div className="container py-6 max-w-6xl">
        <Link to="/class-videos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-3">
          <ChevronLeft className="h-4 w-4" /> Back to library
        </Link>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div>
            <div className="rounded-xl overflow-hidden bg-black">
              <SecureMediaPlayer
                videoUrl={video.video_url}
                videoPlatform={video.video_platform}
                title={video.title}
                clipStart={video.clip_start_seconds || 0}
                clipEnd={video.clip_end_seconds || undefined}
              />
            </div>

            <div className="mt-4">
              <h1 className="text-xl md:text-2xl font-bold leading-tight">{video.title}</h1>

              <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground mt-2">
                <span className="flex items-center gap-1"><Eye className="h-4 w-4" /> {video.views_count} views</span>
                <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}</span>
                <Badge variant="secondary" className="gap-1">
                  <VisIcon className="h-3 w-3" />
                  {video.visibility === 'paid' ? 'Paid' : video.visibility === 'logged_in' ? 'Members' : 'Public'}
                </Badge>
                {video.video_categories && (
                  <Link to={`/class-videos/category/${video.video_categories.slug}`}>
                    <Badge variant="outline" className="hover:bg-secondary">{video.video_categories.name}</Badge>
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Button
                  variant={isLiked ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => user ? toggle.mutate(isLiked) : null}
                  disabled={!user || toggle.isPending}
                  className="gap-2"
                >
                  <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                  {video.likes_count} {isLiked ? 'Liked' : 'Like'}
                </Button>
                {!user && (
                  <span className="text-xs text-muted-foreground">
                    <Link to="/login" className="text-primary hover:underline">Login</Link> to like
                  </span>
                )}
              </div>

              {video.description && (
                <div className="mt-4 p-4 rounded-lg bg-muted/30 text-sm whitespace-pre-wrap">
                  {video.description}
                </div>
              )}

              {video.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {video.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>
                  ))}
                </div>
              )}
            </div>

            <CommentThread videoId={video.id} />
          </div>

          {/* Related */}
          <aside className="space-y-3">
            <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">Related Videos</h3>
            {!related || related.length === 0 ? (
              <p className="text-sm text-muted-foreground">No related videos.</p>
            ) : (
              <div className="space-y-3">
                {related.map((v) => <VideoCard key={v.id} video={v} />)}
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
