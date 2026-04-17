import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Monitor, Loader2, MoreVertical
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Phone, Mail, User as UserIcon } from 'lucide-react';
import { trackMetaEvent } from '@/lib/metaPixel';
import PlayerShell from './PlayerShell';
import { useAuth } from '@/hooks/useAuth';
import { SITE_CONFIG } from '@/lib/constants';
import otsLogo from '@/assets/OTS_LOGO.png';

interface SecureMediaPlayerProps {
  videoUrl?: string | null;
  videoPlatform?: string | null;
  title?: string;
  onProgress?: (seconds: number) => void;
  startPosition?: number;
  watermark?: string;
  showControls?: boolean;
  className?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractDriveId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{20,})/,
    /[?&]id=([a-zA-Z0-9_-]{20,})/,
    /\/d\/([a-zA-Z0-9_-]{20,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  const fallback = url.match(/[-\w]{25,}/);
  return fallback ? fallback[0] : null;
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function parseVideoSource(url: string, platform?: string | null) {
  if (!url) return { type: 'none' as const, embedUrl: '' };

  if (platform === 'youtube' || /youtube\.com|youtu\.be/i.test(url)) {
    const id = extractYouTubeId(url);
    if (id) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return {
        type: 'youtube' as const,
        embedUrl: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&iv_load_policy=3&cc_load_policy=0&fs=1&playsinline=1&enablejsapi=1${origin ? `&origin=${origin}` : ''}`,
        videoId: id,
      };
    }
  }

  if (platform === 'vimeo' || url.includes('vimeo')) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    if (match) {
      return {
        type: 'vimeo' as const,
        embedUrl: `https://player.vimeo.com/video/${match[1]}?title=0&byline=0&portrait=0&dnt=1`,
        videoId: match[1],
      };
    }
  }

  if (platform === 'drive' || url.includes('drive.google.com')) {
    const id = extractDriveId(url);
    if (id) {
      return {
        type: 'drive' as const,
        embedUrl: `https://drive.google.com/file/d/${id}/preview?rm=minimal&usp=drive_web`,
        videoId: id,
      };
    }
  }

  if (/\.(mp4|webm|ogg|mov|m3u8)(\?|$)/i.test(url) || platform === 'upload' || platform === 'direct') {
    return { type: 'direct' as const, embedUrl: url };
  }

  // Generic embeddable URL fallback (https iframe)
  if (/^https?:\/\//i.test(url)) {
    return { type: 'iframe' as const, embedUrl: url };
  }

  if (import.meta.env.DEV) {
    console.warn('[SecureMediaPlayer] Unrecognised video URL:', url, 'platform:', platform);
  }
  return { type: 'none' as const, embedUrl: '' };
}

function formatTime(s: number) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const SOURCE_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  drive: 'Drive',
  direct: 'Video',
  iframe: 'Embed',
};

// ─── Component ──────────────────────────────────────────────────────────────

const SecureMediaPlayer = ({
  videoUrl,
  videoPlatform,
  title,
  onProgress,
  startPosition = 0,
  watermark,
  showControls = true,
  className = '',
}: SecureMediaPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval>>();

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showOverlay, setShowOverlay] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const source = useMemo(
    () => parseVideoSource(videoUrl || '', videoPlatform),
    [videoUrl, videoPlatform]
  );

  const isDirect = source.type === 'direct';

  useEffect(() => {
    if (!isDirect || !videoRef.current) return;
    const v = videoRef.current;
    v.volume = volume / 100;
    v.muted = muted;
    v.playbackRate = playbackRate;
  }, [volume, muted, playbackRate, isDirect]);

  useEffect(() => {
    if (!isDirect || !videoRef.current || !startPosition) return;
    videoRef.current.currentTime = startPosition;
  }, [startPosition, isDirect]);

  const watchMilestonesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    watchMilestonesRef.current = new Set();
  }, [videoUrl]);

  useEffect(() => {
    if (!isDirect || !videoRef.current) return;
    const v = videoRef.current;

    const onLoaded = () => {
      setDuration(v.duration);
      setLoading(false);
      if (startPosition) v.currentTime = startPosition;
    };
    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime);
      onProgress?.(v.currentTime);
      if (v.duration > 0) {
        const pct = Math.round((v.currentTime / v.duration) * 100);
        [25, 50, 75, 100].forEach((m) => {
          if (pct >= m && !watchMilestonesRef.current.has(m)) {
            watchMilestonesRef.current.add(m);
            trackMetaEvent('WatchVideo', {
              video_url: videoUrl,
              video_title: title,
              milestone: m,
              duration_seconds: Math.round(v.duration),
            });
          }
        });
      }
    };
    const onPlay = () => {
      setPlaying(true);
      if (!watchMilestonesRef.current.has(0)) {
        watchMilestonesRef.current.add(0);
        trackMetaEvent('WatchVideo', {
          video_url: videoUrl,
          video_title: title,
          milestone: 0,
          action: 'play',
        });
      }
    };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);

    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('canplay', onCanPlay);

    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('canplay', onCanPlay);
    };
  }, [isDirect, startPosition, onProgress, videoUrl, title]);

  useEffect(() => {
    if (isDirect || !playing) return;
    progressInterval.current = setInterval(() => {
      setCurrentTime(prev => {
        const next = prev + 1;
        onProgress?.(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(progressInterval.current);
  }, [isDirect, playing, onProgress]);

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    if (playing && isFullscreen) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    }
  }, [playing, isFullscreen]);

  useEffect(() => {
    if (!playing || !isFullscreen) setControlsVisible(true);
  }, [playing, isFullscreen]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;

      if (isDirect && videoRef.current) {
        const v = videoRef.current;
        switch (e.key) {
          case ' ':
          case 'k':
            e.preventDefault();
            playing ? v.pause() : v.play();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            v.currentTime = Math.max(0, v.currentTime - 10);
            break;
          case 'ArrowRight':
            e.preventDefault();
            v.currentTime = Math.min(v.duration, v.currentTime + 10);
            break;
          case 'ArrowUp':
            e.preventDefault();
            setVolume(prev => Math.min(100, prev + 10));
            break;
          case 'ArrowDown':
            e.preventDefault();
            setVolume(prev => Math.max(0, prev - 10));
            break;
          case 'm':
            e.preventDefault();
            setMuted(p => !p);
            break;
          case 'f':
            e.preventDefault();
            toggleFullscreen();
            break;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isDirect, playing, toggleFullscreen]);

  const togglePlay = () => {
    if (!isDirect) {
      setPlaying(!playing);
      setShowOverlay(false);
      return;
    }
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
      setShowOverlay(false);
    }
  };

  const seek = (value: number[]) => {
    if (!isDirect || !videoRef.current) return;
    videoRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const skip = (delta: number) => {
    if (!isDirect || !videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + delta));
  };

  if (!videoUrl || source.type === 'none') {
    return (
      <PlayerShell>
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center text-white/50">
            <Monitor className="h-16 w-16 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No video available for this lesson</p>
          </div>
        </div>
      </PlayerShell>
    );
  }

  const sourceLabel = SOURCE_LABEL[source.type] ?? 'Video';

  // ─── Header ───────────────────────────────────────────────────────────
  const header = (
    <>
      <Badge
        variant="outline"
        className="bg-white/5 text-white border-white/15 text-[10px] uppercase tracking-wider px-2 py-0.5 shrink-0"
      >
        <Play className="h-2.5 w-2.5 mr-1 fill-white" />
        <span className="hidden xs:inline">{sourceLabel}</span>
      </Badge>
      <p className="flex-1 text-white/90 text-xs sm:text-sm font-medium truncate min-w-0">
        {title || 'Lesson video'}
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10 shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[160px]">
          <DropdownMenuLabel className="text-xs">Playback Speed</DropdownMenuLabel>
          {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => (
            <DropdownMenuItem
              key={rate}
              onClick={() => setPlaybackRate(rate)}
              className={`text-xs ${playbackRate === rate ? 'bg-accent' : ''}`}
              disabled={!isDirect}
            >
              {rate}x {playbackRate === rate ? '✓' : ''}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={toggleFullscreen} className="text-xs">
            {isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  // ─── Footer ───────────────────────────────────────────────────────────
  const footer = isDirect ? (
    <div className="w-full py-2">
      <div className="mb-1.5">
        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 100}
          step={0.1}
          onValueChange={seek}
          className="cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white"
        />
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={() => skip(-10)}>
          <SkipBack className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={togglePlay}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={() => skip(10)}>
          <SkipForward className="h-3.5 w-3.5" />
        </Button>
        <span className="text-white/80 text-[11px] tabular-nums px-2 whitespace-nowrap">
          {formatTime(currentTime)} <span className="text-white/40">/ {formatTime(duration)}</span>
        </span>
        <div className="flex-1" />
        <div className="hidden sm:flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={() => setMuted(!muted)}>
            {muted || volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
          <div className="w-16 md:w-20">
            <Slider
              value={[muted ? 0 : volume]}
              min={0}
              max={100}
              step={1}
              onValueChange={v => { setVolume(v[0]); setMuted(v[0] === 0); }}
              className="[&_[role=slider]]:h-2.5 [&_[role=slider]]:w-2.5 [&_[role=slider]]:bg-white"
            />
          </div>
        </div>
        <span className="hidden md:inline text-white/60 text-[10px] tabular-nums px-1">{playbackRate}x</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  ) : (
    <div className="w-full flex items-center gap-2 py-2">
      <span className="text-white/60 text-[11px] truncate flex-1">
        Playback controls available inside the {sourceLabel} player
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10 shrink-0" onClick={toggleFullscreen}>
        {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={`select-none ${className}`}
      onMouseMove={resetHideTimer}
      onContextMenu={e => e.preventDefault()}
      onDragStart={e => e.preventDefault()}
      tabIndex={0}
    >
      <PlayerShell
        isFullscreen={isFullscreen}
        header={showControls ? header : undefined}
        footer={showControls ? footer : undefined}
      >
        {/* Video content */}
        {isDirect ? (
          <video
            ref={videoRef}
            src={source.embedUrl}
            className="w-full h-full object-contain"
            playsInline
            preload="metadata"
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
          />
        ) : (
          <iframe
            src={source.embedUrl}
            className="w-full h-full"
            allowFullScreen
            allow="autoplay; encrypted-media; fullscreen"
            sandbox={
              source.type === 'drive'
                ? 'allow-scripts allow-same-origin allow-presentation'
                : 'allow-scripts allow-same-origin allow-presentation allow-popups'
            }
            referrerPolicy="no-referrer"
            loading="eager"
            onLoad={() => setLoading(false)}
          />
        )}

        {/* Drive click-shields */}
        {source.type === 'drive' && (
          <>
            <div
              className="absolute top-0 right-0 h-14 w-32 z-[5] cursor-not-allowed"
              aria-hidden="true"
              onClick={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
            />
            <div
              className="absolute bottom-0 right-0 h-12 w-24 z-[5] cursor-not-allowed"
              aria-hidden="true"
              onClick={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
            />
          </>
        )}

        {/* Loading spinner */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
            <Loader2 className="h-10 w-10 text-white animate-spin" />
          </div>
        )}

        {/* Watermark overlay */}
        {watermark && (
          <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center" style={{ transform: 'rotate(-30deg)' }}>
              <p className="text-white/[0.04] text-4xl font-bold whitespace-nowrap select-none">
                {watermark}
              </p>
            </div>
          </div>
        )}

        {/* Initial play overlay for embedded */}
        {showOverlay && !playing && !isDirect && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/30 z-20 cursor-pointer"
            onClick={togglePlay}
          >
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
              <Play className="h-8 w-8 text-white fill-white ml-1" />
            </div>
          </div>
        )}

        {/* Fullscreen-only floating header/footer (auto-hide) */}
        {isFullscreen && showControls && controlsVisible && (
          <>
            <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-2 px-4 h-12 bg-gradient-to-b from-black/80 to-transparent">
              {header}
            </div>
            <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-2 pt-10 bg-gradient-to-t from-black/80 to-transparent">
              {footer}
            </div>
          </>
        )}
      </PlayerShell>

      {/* CSS to prevent downloading */}
      <style>{`
        video::-webkit-media-controls-enclosure { overflow: hidden; }
        video::-webkit-media-controls-panel { display: none !important; }
        video::-webkit-media-controls-download-button { display: none !important; }
        video::-webkit-media-controls-overflow-button { display: none !important; }
        video::-internal-media-controls-download-button { display: none !important; }
      `}</style>
    </div>
  );
};

export default SecureMediaPlayer;
