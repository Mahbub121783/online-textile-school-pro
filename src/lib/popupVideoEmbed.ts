// Helpers for popup background/foreground video embedding

export type VideoKind = 'youtube' | 'vimeo' | 'file' | 'unknown';

export const detectVideoKind = (url: string): VideoKind => {
  if (!url) return 'unknown';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/vimeo\.com/i.test(url)) return 'vimeo';
  if (/\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url)) return 'file';
  return 'unknown';
};

const extractYouTubeId = (url: string): string | null => {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

const extractVimeoId = (url: string): string | null => {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
};

/** Build an embed URL for YouTube/Vimeo with autoplay+mute+loop for backgrounds */
export const buildBackgroundEmbedUrl = (url: string): string | null => {
  const kind = detectVideoKind(url);
  if (kind === 'youtube') {
    const id = extractYouTubeId(url);
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&controls=0&showinfo=0&modestbranding=1&rel=0&iv_load_policy=3&playlist=${id}&playsinline=1`;
  }
  if (kind === 'vimeo') {
    const id = extractVimeoId(url);
    if (!id) return null;
    return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1&background=1&controls=0`;
  }
  return null;
};
