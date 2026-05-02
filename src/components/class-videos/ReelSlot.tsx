import { useEffect, useRef, useState, forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Eye, Volume2, VolumeX, Play, Pause, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useTrackVideoView, useVideoLike, type ClassVideo } from '@/hooks/useClassVideos';
import { getYoutubeEmbedUrl, getYoutubeThumb } from '@/lib/youtube';
import { toast } from '@/hooks/use-toast';

const ACTIVE_EVENT = 'class-video-reel-active';

interface Props {
  video: ClassVideo;
  isActive: boolean;
  index: number;
  onCommentClick: () => void;
  onAdvance: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

const ReelSlot = forwardRef<HTMLDivElement, Props>(function ReelSlot(
  { video, isActive, onCommentClick, onAdvance, muted, onToggleMute },
  ref
) {
  const { user } = useAuth();
  const { isLiked, toggle } = useVideoLike(video.id);
  const trackView = useTrackVideoView();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [expandedDesc, setExpandedDesc] = useState(false);
  const viewedRef = useRef(false);

  const isYouTube = video.video_platform === 'youtube';
  const ytThumb = isYouTube ? getYoutubeThumb(video.video_url, 'max') || getYoutubeThumb(video.video_url, 'hq') : null;
  const ytEmbed = isYouTube
    ? getYoutubeEmbedUrl(video.video_url, {
        autoplay: isActive,
        mute: muted,
        controls: true,
        start: video.clip_start_seconds || undefined,
        end: video.clip_end_seconds || undefined,
      })
    : null;

  // Broadcast active to pause others when becoming active
  useEffect(() => {
    if (isActive) {
      window.dispatchEvent(new CustomEvent(ACTIVE_EVENT, { detail: video.id }));
    }
  }, [isActive, video.id]);

  // Track view after 2s of being active
  useEffect(() => {
    if (!isActive || viewedRef.current) return;
    const t = setTimeout(() => {
      if (viewedRef.current) return;
      viewedRef.current = true;
      trackView.mutate(video.id);
    }, 2000);
    return () => clearTimeout(t);
  }, [isActive, video.id, trackView]);

  // Drive direct video play/pause based on active
  useEffect(() => {
    const v = videoRef.current;
    if (!v || isYouTube) return;
    if (isActive && !isPaused) {
      try { if (v.currentTime < (video.clip_start_seconds || 0)) v.currentTime = video.clip_start_seconds || 0; } catch { /* ignore */ }
      v.play().catch(() => { /* autoplay blocked */ });
    } else {
      v.pause();
    }
  }, [isActive, isPaused, isYouTube, video.clip_start_seconds]);

  // Sync mute
  useEffect(() => {
    const v = videoRef.current;
    if (!v || isYouTube) return;
    v.muted = muted;
  }, [muted, isYouTube]);

  // Listen for other slots becoming active
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail !== video.id) {
        const v = videoRef.current;
        if (v && !isYouTube) v.pause();
      }
    };
    window.addEventListener(ACTIVE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_EVENT, handler);
  }, [video.id, isYouTube]);

  const handleEnded = () => {
    onAdvance();
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (video.clip_end_seconds && v.currentTime >= video.clip_end_seconds) {
      onAdvance();
    }
  };

  const togglePlayPause = () => {
    if (!isActive) return;
    setIsPaused((p) => !p);
  };

  const handleLike = () => {
    if (!user) {
      toast({ title: 'Login required', description: 'Login to like videos' });
      return;
    }
    toggle.mutate(isLiked);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/class-videos/${video.slug}`;
    if (navigator.share) {
      try { await navigator.share({ title: video.title, url }); } catch { /* dismissed */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied' });
      } catch {
        toast({ title: 'Could not copy', variant: 'destructive' });
      }
    }
  };

  return (
    <div
      ref={ref}
      data-video-id={video.id}
      className="relative w-full snap-start snap-always flex items-center justify-center bg-black"
      style={{ height: '100dvh', minHeight: '100dvh' }}
    >
      {/* Blurred backdrop (poster) */}
      {ytThumb && (
        <div
          className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl opacity-40"
          style={{ backgroundImage: `url(${ytThumb})` }}
          aria-hidden
        />
      )}

      {/* Centered media frame */}
      <div className="relative z-10 w-full h-full flex items-center justify-center" onClick={togglePlayPause}>
        {isYouTube ? (
          isActive && ytEmbed ? (
            <iframe
              key={`${video.id}-${muted ? 'm' : 'u'}`}
              src={ytEmbed}
              title={video.title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="w-full h-full max-w-[min(100vw,calc(100dvh*16/9))] max-h-[100dvh] aspect-video"
            />
          ) : (
            ytThumb && (
              <img
                src={ytThumb}
                alt={video.title}
                className="max-w-full max-h-full object-contain"
              />
            )
          )
        ) : (
          <video
            ref={videoRef}
            src={video.video_url}
            playsInline
            loop={false}
            preload={isActive ? 'auto' : 'metadata'}
            onEnded={handleEnded}
            onTimeUpdate={handleTimeUpdate}
            poster={video.thumbnail_url || undefined}
            className="max-w-full max-h-full object-contain"
          />
        )}

        {/* Center play/pause indicator */}
        {!isYouTube && isActive && isPaused && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-20 w-20 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
              <Play className="h-10 w-10 text-white ml-1" fill="currentColor" />
            </div>
          </div>
        )}
      </div>

      {/* Top-left back button */}
      <Link
        to="/class-videos"
        className="absolute top-4 left-3 z-30 h-9 w-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        aria-label="Back to library"
        onClick={(e) => e.stopPropagation()}
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>

      {/* Top-right mute toggle (only for non-YT, since YT iframe has its own controls) */}
      {!isYouTube && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
          className="absolute top-4 right-3 z-30 h-9 w-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      )}

      {/* Right action rail */}
      <div className="absolute right-2 sm:right-4 bottom-28 sm:bottom-32 z-30 flex flex-col items-center gap-4">
        <button
          onClick={(e) => { e.stopPropagation(); handleLike(); }}
          className="flex flex-col items-center gap-1 text-white"
          aria-label="Like"
        >
          <div className={`h-11 w-11 rounded-full backdrop-blur flex items-center justify-center transition-colors ${isLiked ? 'bg-primary' : 'bg-black/40 hover:bg-black/60'}`}>
            <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
          </div>
          <span className="text-[11px] font-semibold tabular-nums drop-shadow">{video.likes_count + (isLiked && !video.likes_count ? 1 : 0)}</span>
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onCommentClick(); }}
          className="flex flex-col items-center gap-1 text-white"
          aria-label="Comments"
        >
          <div className="h-11 w-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center hover:bg-black/60 transition-colors">
            <MessageCircle className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-semibold tabular-nums drop-shadow">{video.comments_count}</span>
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); handleShare(); }}
          className="flex flex-col items-center gap-1 text-white"
          aria-label="Share"
        >
          <div className="h-11 w-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center hover:bg-black/60 transition-colors">
            <Share2 className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-semibold drop-shadow">Share</span>
        </button>

        <div className="flex flex-col items-center gap-1 text-white" aria-label="Views">
          <div className="h-11 w-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
            <Eye className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-semibold tabular-nums drop-shadow">{video.views_count}</span>
        </div>
      </div>

      {/* Bottom info overlay */}
      <div
        className="absolute left-0 right-16 sm:right-24 bottom-0 z-20 p-4 sm:p-6 pb-8 sm:pb-10 bg-gradient-to-t from-black/85 via-black/50 to-transparent text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {video.video_categories && (
          <Link to={`/class-videos/category/${video.video_categories.slug}`}>
            <Badge className="mb-2 bg-white/15 hover:bg-white/25 text-white border-0 text-[10px]">
              {video.video_categories.icon ? `${video.video_categories.icon} ` : ''}{video.video_categories.name}
            </Badge>
          </Link>
        )}
        <h2 className="text-base sm:text-lg font-bold leading-tight line-clamp-2">{video.title}</h2>
        {video.description && (
          <div className="mt-1.5">
            <p className={`text-xs sm:text-sm text-white/85 whitespace-pre-wrap ${expandedDesc ? '' : 'line-clamp-2'}`}>
              {video.description}
            </p>
            {video.description.length > 100 && (
              <button
                className="text-[11px] font-semibold text-white/90 mt-1 hover:underline"
                onClick={() => setExpandedDesc((v) => !v)}
              >
                {expandedDesc ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}
        {video.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {video.tags.slice(0, 4).map((t) => (
              <span key={t} className="text-[10px] text-white/70">#{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default ReelSlot;
