import { Link } from 'react-router-dom';
import { Play, Eye, Heart, MessageCircle, Lock, Users, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ClassVideo } from '@/hooks/useClassVideos';

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

interface Props {
  video: ClassVideo;
}

export default function VideoCard({ video }: Props) {
  const cat = video.video_categories;
  const duration = video.clip_end_seconds && video.clip_start_seconds != null
    ? video.clip_end_seconds - video.clip_start_seconds
    : video.duration_seconds;

  return (
    <Link
      to={`/class-videos/${video.slug}`}
      className="group block rounded-xl overflow-hidden bg-card border border-border hover:border-primary/40 hover:shadow-lg transition-all"
    >
      <div className="relative aspect-video bg-muted overflow-hidden">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
            <Play className="h-12 w-12 text-primary/60" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl">
            <Play className="h-6 w-6 ml-0.5" fill="currentColor" />
          </div>
        </div>
        {duration ? (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[11px] font-medium bg-black/80 text-white tabular-nums">
            {formatDuration(duration)}
          </span>
        ) : null}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-black/70 text-white backdrop-blur-sm">
          {visibilityIcon(video.visibility)}
          {video.visibility === 'paid' ? 'Paid' : video.visibility === 'logged_in' ? 'Login' : 'Free'}
        </span>
      </div>
      <div className="p-3 space-y-1.5">
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
