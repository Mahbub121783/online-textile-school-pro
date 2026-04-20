/**
 * Build a Cloudinary delivery URL from cloud_name + public_id.
 * Defaults to f_auto,q_auto for optimal format/quality.
 */
export function buildCloudinaryUrl(
  cloudName: string,
  publicId: string,
  transforms = 'f_auto,q_auto'
): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${publicId}`;
}

export interface MediaReference {
  id: string;
  url: string;
  storage_source: string;
  public_id?: string | null;
  fallback_url?: string | null;
  cloudinary_account_id?: string | null;
}

/**
 * Resolve the best URL for a media reference.
 * Prefers the active URL; caller should use handleImgError on <img> tags.
 */
export function resolveMediaUrl(ref: MediaReference): string {
  return ref.url || ref.fallback_url || '';
}

/**
 * onError handler for <img> tags — swaps src to fallback_url if Cloudinary fails.
 */
export function handleImgError(
  e: React.SyntheticEvent<HTMLImageElement>,
  fallbackUrl?: string | null
) {
  const img = e.currentTarget;
  if (fallbackUrl && img.src !== fallbackUrl) {
    img.src = fallbackUrl;
  }
}

interface CldImgOptions {
  w?: number;
  h?: number;
  /** crop mode: fill (default), fit, limit, thumb, scale */
  c?: 'fill' | 'fit' | 'limit' | 'thumb' | 'scale' | 'pad';
  /** gravity: auto (default), face, center */
  g?: 'auto' | 'face' | 'center' | 'faces';
  /** aspect ratio like '1:1', '16:9' */
  ar?: string;
  /** quality override (default q_auto) */
  q?: string | number;
  /** format override (default f_auto) */
  f?: string;
  /** dpr (device pixel ratio), default auto */
  dpr?: string | number;
}

/**
 * Inject Cloudinary delivery transforms into an existing secure URL.
 * If the URL is not a Cloudinary URL, returns it unchanged.
 *
 * Example:
 *   cldImg('https://res.cloudinary.com/x/image/upload/v123/foo.png', { w: 320, c: 'fill' })
 *   → 'https://res.cloudinary.com/x/image/upload/f_auto,q_auto,c_fill,g_auto,w_320,dpr_auto/v123/foo.png'
 */
export function cldImg(url?: string | null, opts: CldImgOptions = {}): string {
  if (!url) return '';
  // Only transform Cloudinary URLs
  if (!/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\//.test(url)) return url;

  const {
    w,
    h,
    c = w || h ? 'fill' : undefined,
    g = c === 'fill' ? 'auto' : undefined,
    ar,
    q = 'auto',
    f = 'auto',
    dpr = 'auto',
  } = opts;

  const parts: string[] = [`f_${f}`, `q_${q}`];
  if (c) parts.push(`c_${c}`);
  if (g) parts.push(`g_${g}`);
  if (ar) parts.push(`ar_${ar}`);
  if (w) parts.push(`w_${w}`);
  if (h) parts.push(`h_${h}`);
  if (dpr) parts.push(`dpr_${dpr}`);

  const transformSegment = parts.join(',');

  // Strip any pre-existing transform segment between /upload/ and the version/public_id.
  // Cloudinary URLs look like: .../upload/[transforms/]v123/path or .../upload/[transforms/]path
  return url.replace(
    /(\/(image|video)\/upload\/)(?:[^/]+\/)*(v\d+\/|)/,
    (_match, uploadSeg, _kind, versionSeg) => `${uploadSeg}${transformSegment}/${versionSeg}`
  );
}
