import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Eye, Heart, MessageCircle, Lock, Users, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ClassVideo } from '@/hooks/useClassVideos';
import { getYoutubeThumb, getYoutubeEmbedUrl } from '@/lib/youtube';

function formatDuration(seconds: number | null) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function visibilityIcon(v: ClassVideo['visibility']) {
  if (v === 'paid') return <Lock className="h-3 w-3" />;
  if (v === 'logged_in') return <Users className="h-3 w-3" />;
  return <Globe className="h-3 w-3" />;
}

const ACTIVE_EVENT = 'class-video-card-active';

interface Props {
  video: ClassVideo;
}

export default function VideoCard({ video }: Props) {
  const cat = video.video_categories;
  const duration = video.clip_end_seconds && video.clip_start_seconds != null
    ? video.clip_end_seconds - video.clip_start_seconds
    : video.duration_seconds;

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const cardIdRef = useRef<string>(video.id);

  const isYouTube = video.video_platform === 'youtube';
  const ytThumb = isYouTube ? getYoutubeThumb(video.video_url, 'hq') : null;
  const ytEmbed = isYouTube
    ? getYoutubeEmbedUrl(video.video_url, {
        autoplay: true, mute: true, controls: false,
        start: video.clip_start_seconds || undefined,
        end: video.clip_end_seconds || undefined,
        loop: true,
      })
    : null;

  // Broadcast active card to pause others
  const activate = () => {
    window.dispatchEvent(new CustomEvent(ACTIVE_EVENT, { detail: cardIdRef.current }));
    setIsPreviewing(true);
  };
  const deactivate = () => {
    setIsPreviewing(false);
    const v = videoRef.current;
    if (v) {
      v.pause();
      try { v.currentTime = video.clip_start_seconds || 0; } catch { /* ignore */ }
    }
  };

  // Listen for other cards activating — pause self
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail !== cardIdRef.current) deactivate();
    };
    window.addEventListener(ACTIVE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_EVENT, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mobile: IntersectionObserver auto-play when ≥60% visible (touch devices only)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const isTouch = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
    if (!isTouch) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            activate();
          } else if (!entry.isIntersecting) {
            deactivate();
          }
        });
      },
      { threshold: [0, 0.6, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger play on <video> when previewing
  useEffect(() => {
    const v = videoRef.current;
    if (!v || isYouTube) return;
    if (isPreviewing) {
      try { v.currentTime = video.clip_start_seconds || 0; } catch { /* ignore */ }
      v.play().catch(() => { /* autoplay blocked, ignore */ });
    }
  }, [isPreviewing, isYouTube, video.clip_start_seconds]);

  // Enforce clip end for direct video
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (video.clip_end_seconds && v.currentTime >= video.clip_end_seconds) {
      v.currentTime = video.clip_start_seconds || 0;
      v.play().catch(() => { /* ignore */ });
    }
  };

  return (
    <Link
      to={`/class-videos/${video.slug}`}
      className="group block rounded-lg sm:rounded-xl overflow-hidden bg-card border border-border hover:border-primary/40 hover:shadow-lg transition-all active:scale-[0.98]"
    >
      <div
        ref={containerRef}
        className="relative aspect-[3/4] sm:aspect-video bg-muted overflow-hidden"
        onMouseEnter={activate}
        onMouseLeave={deactivate}
      >
        {/* Poster / fallback layer */}
        {isYouTube && ytThumb ? (
          <img
            src={ytThumb}
            alt={video.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          !isYouTube && (
            <video
              ref={videoRef}
              src={video.video_url}
              muted
              playsInline
              loop
              preload="metadata"
              onTimeUpdate={handleTimeUpdate}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )
        )}

        {/* Fallback placeholder when no YT thumb and not video */}
        {isYouTube && !ytThumb && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
            <Play className="h-12 w-12 text-primary/60" />
          </div>
        )}

        {/* YouTube hover preview iframe */}
        {isYouTube && isPreviewing && ytEmbed && (
          <iframe
            src={ytEmbed}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        )}

        {/* Play button overlay (hidden while previewing) */}
        {!isPreviewing && (
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-xl opacity-90 group-hover:scale-110 transition-transform">
              <Play className="h-4 w-4 sm:h-6 sm:w-6 ml-0.5" fill="currentColor" />
            </div>
          </div>
        )}

        {/* Mobile-only bottom title overlay (reel-style) */}
        <div className="sm:hidden absolute inset-x-0 bottom-0 p-2 pt-6 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none">
          <h3 className="text-[12px] font-semibold text-white leading-tight line-clamp-2 drop-shadow">
            {video.title}
          </h3>
          <div className="flex items-center gap-2 text-[10px] text-white/80 mt-1">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {video.views_count}</span>
            {duration ? <span className="tabular-nums">{formatDuration(duration)}</span> : null}
          </div>
        </div>

        {duration ? (
          <span className="hidden sm:inline-flex absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[11px] font-medium bg-black/80 text-white tabular-nums z-10">
            {formatDuration(duration)}
          </span>
        ) : null}
        <span className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide bg-black/70 text-white backdrop-blur-sm z-10">
          {visibilityIcon(video.visibility)}
          <span className="hidden sm:inline">{video.visibility === 'paid' ? 'Paid' : video.visibility === 'logged_in' ? 'Login' : 'Free'}</span>
        </span>
      </div>
      {/* Desktop info area (mobile uses overlay above) */}
      <div className="hidden sm:block p-3 space-y-1.5">
        {cat && (
          <Badge variant="secondary" className="text-[10px] font-medium">
            {cat.name}
          </Badge>
        )}
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {video.title}
        </h3>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {video.views_count}</span>
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {video.likes_count}</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {video.comments_count}</span>
        </div>
      </div>
    </Link>
  );
}
