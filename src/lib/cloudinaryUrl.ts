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
