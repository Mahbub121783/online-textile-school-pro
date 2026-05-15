// Centralized helper to detect when the app runs inside the Lovable EDITOR
// preview iframe (id-preview--*). Used to gate non-essential behaviour
// (popups, analytics, maintenance redirects) so editor sessions don't burn
// through the project's compute/IO budget.
//
// IMPORTANT: This must NEVER match the published site (lovable.app /
// lovableproject.com root domains, or custom domains). Otherwise real
// visitors get a broken/empty experience.
export const isPreviewOrEmbedded = (() => {
  if (typeof window === 'undefined') return false;
  try {
    const host = window.location.hostname;
    // Lovable editor preview iframe only
    return host.startsWith('id-preview--') || host.includes('sandbox.lovable');
  } catch {
    return false;
  }
})();
