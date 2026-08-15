const ROOT_DOMAIN = 'onlinetextileschool.com';
const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'mail', 'cpanel', 'webmail', 'autodiscover', 'ftp', 'admin']);

// A campus's provisioned subdomain (e.g. greenvalley.onlinetextileschool.com)
// points at the same docroot as the main site (see campusOnboard.js --
// no extra Node process per campus), so the SPA itself has to notice it's
// being loaded on a campus hostname and render that campus's portfolio
// instead of the normal site.
export function getCampusSubdomainSlug(): string | null {
  const host = window.location.hostname;
  if (!host.endsWith(`.${ROOT_DOMAIN}`)) return null;
  const sub = host.slice(0, -(ROOT_DOMAIN.length + 1));
  if (!sub || sub.includes('.') || RESERVED_SUBDOMAINS.has(sub)) return null;
  return sub;
}
