// Centralized helper to detect when the app runs inside the Lovable preview
// iframe or any embedded host. Used to gate non-essential Supabase queries
// so editor sessions don't burn through the project's compute/IO budget.
export const isPreviewOrEmbedded = (() => {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.self !== window.top ||
      window.location.hostname.includes('id-preview--') ||
      window.location.hostname.includes('lovable.app') ||
      window.location.hostname.includes('lovableproject.com')
    );
  } catch {
    return true;
  }
})();
