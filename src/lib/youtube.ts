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
  p.set('enablejsapi', '1');
  // `origin` is required (not just recommended) once enablejsapi=1 is set --
  // omitting it is a common real-world cause of YouTube's "Error 153: Video
  // player configuration error". youtube-nocookie.com avoids the
  // third-party-cookie-blocked embed failures that are the other common
  // cause of the same error under strict browser privacy settings.
  if (typeof window !== 'undefined') p.set('origin', window.location.origin);
  return `https://www.youtube-nocookie.com/embed/${id}?${p.toString()}`;
}

/** Send a YT IFrame API command via postMessage (requires enablejsapi=1). */
export function sendYTCommand(
  iframe: HTMLIFrameElement | null,
  func: 'playVideo' | 'pauseVideo' | 'mute' | 'unMute',
  args: unknown[] = []
) {
  if (!iframe?.contentWindow) return;
  try {
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*'
    );
  } catch {
    /* ignore */
  }
}
