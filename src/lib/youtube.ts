export function getYoutubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null;
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null;
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
    }
  } catch {
    // fallthrough to regex
  }
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function getYoutubeThumb(url: string, quality: 'hq' | 'mq' | 'max' = 'hq'): string | null {
  const id = getYoutubeId(url);
  if (!id) return null;
  const map = { hq: 'hqdefault', mq: 'mqdefault', max: 'maxresdefault' };
  return `https://img.youtube.com/vi/${id}/${map[quality]}.jpg`;
}

export function getYoutubeEmbedUrl(
  url: string,
  opts: { autoplay?: boolean; mute?: boolean; controls?: boolean; start?: number; end?: number; loop?: boolean } = {}
): string | null {
  const id = getYoutubeId(url);
  if (!id) return null;
  const p = new URLSearchParams();
  if (opts.autoplay) p.set('autoplay', '1');
  if (opts.mute) p.set('mute', '1');
  p.set('controls', opts.controls ? '1' : '0');
  if (opts.start) p.set('start', String(Math.floor(opts.start)));
  if (opts.end) p.set('end', String(Math.floor(opts.end)));
  if (opts.loop) { p.set('loop', '1'); p.set('playlist', id); }
  p.set('modestbranding', '1');
  p.set('rel', '0');
  p.set('playsinline', '1');
  return `https://www.youtube.com/embed/${id}?${p.toString()}`;
}
