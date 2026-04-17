import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Settings, Monitor, Loader2
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { trackMetaEvent } from '@/lib/metaPixel';

interface SecureMediaPlayerProps {
  videoUrl?: string | null;
  videoPlatform?: string | null;
  title?: string;
  /** Called periodically with current playback seconds */
  onProgress?: (seconds: number) => void;
  /** Resume from this position */
  startPosition?: number;
  /** Watermark text (e.g. user email) */
  watermark?: string;
  /** Show controls */
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

function parseVideoSource(url: string, platform?: string | null) {
  if (!url) return { type: 'none' as const, embedUrl: '' };

  // YouTube
  if (platform === 'youtube' || url.includes('youtube') || url.includes('youtu.be')) {
    const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) {
      return {
        type: 'youtube' as const,
        embedUrl: `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1&disablekb=0&iv_load_policy=3&cc_load_policy=0&fs=1&playsinline=1&enablejsapi=1&origin=${window.location.origin}`,
        videoId: match[1],
      };
    }
  }

  // Vimeo
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

  // Google Drive — supports /file/d/{ID}/, ?id={ID}, /uc?id={ID}, /open?id={ID}, /preview
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

  // Direct video (mp4, webm, etc.)
  if (/\.(mp4|webm|ogg|mov|m3u8)(\?|$)/i.test(url) || platform === 'upload') {
    return { type: 'direct' as const, embedUrl: url };
  }

  // Fallback: treat as embeddable iframe
  return { type: 'iframe' as const, embedUrl: url };
}

function formatTime(s: number) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

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

  // ─── Direct video handlers ────────────────────────────────────────────

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

  // Quartile milestones already fired for current video (Meta WatchVideo)
  const watchMilestonesRef = useRef<Set<number>>(new Set());

  // Reset milestones when video URL changes
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
      // Meta WatchVideo quartile tracking
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
      // Fire on first play (milestone 0)
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

  // For embedded players, track time via interval
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

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    }
  }, [playing]);

  useEffect(() => {
    if (!playing) setControlsVisible(true);
  }, [playing]);

  // Fullscreen
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

  // Keyboard shortcuts
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

  // ─── No video ─────────────────────────────────────────────────────────

  if (!videoUrl || source.type === 'none') {
    return (
      <div className={`aspect-video bg-black flex items-center justify-center ${className}`}>
        <div className="text-center text-muted-foreground">
          <Monitor className="h-16 w-16 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No video available for this lesson</p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={`relative aspect-video bg-black group select-none ${className}`}
      onMouseMove={resetHideTimer}
      onContextMenu={e => e.preventDefault()}
      onDragStart={e => e.preventDefault()}
      tabIndex={0}
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
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          referrerPolicy="no-referrer"
          loading="eager"
          onLoad={() => setLoading(false)}
        />
      )}

      {/* Anti-download transparent overlay for embedded players */}
      {!isDirect && (
        <div 
          className="absolute inset-0 z-[1]" 
          style={{ pointerEvents: 'none' }}
        />
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

      {/* Play overlay for initial state */}
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

      {/* Source badge */}
      <div className="absolute top-3 left-3 z-20">
        <Badge
          variant="outline"
          className="bg-black/60 text-white border-white/20 text-[10px] uppercase tracking-wider backdrop-blur-sm"
        >
          {source.type === 'youtube' ? '▶ YouTube' :
           source.type === 'vimeo' ? '▶ Vimeo' :
           source.type === 'drive' ? '▶ Google Drive' :
           source.type === 'direct' ? '▶ Video' : '▶ Embedded'}
        </Badge>
      </div>

      {/* Title */}
      {title && controlsVisible && (
        <div className="absolute top-3 right-3 z-20 max-w-[60%]">
          <p className="text-white text-xs font-medium truncate bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
            {title}
          </p>
        </div>
      )}

      {/* Custom controls for direct video */}
      {isDirect && showControls && controlsVisible && (
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-12 pb-3 px-4 transition-opacity">
          {/* Progress bar */}
          <div className="mb-2">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.1}
              onValueChange={seek}
              className="cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white"
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => skip(-10)}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/20" onClick={togglePlay}>
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => skip(10)}>
              <SkipForward className="h-4 w-4" />
            </Button>

            {/* Time */}
            <span className="text-white text-[11px] tabular-nums min-w-[80px] text-center">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            {/* Volume */}
            <div className="hidden sm:flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setMuted(!muted)}>
                {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <div className="w-20">
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

            {/* Speed */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-white hover:bg-white/20 text-xs px-2">
                  {playbackRate}x
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[80px]">
                {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => (
                  <DropdownMenuItem
                    key={rate}
                    onClick={() => setPlaybackRate(rate)}
                    className={playbackRate === rate ? 'bg-accent' : ''}
                  >
                    {rate}x
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Fullscreen */}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Minimal controls for embedded videos */}
      {!isDirect && showControls && (
        <div className="absolute bottom-3 right-3 z-30">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white bg-black/50 hover:bg-black/70 backdrop-blur-sm"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      )}

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
