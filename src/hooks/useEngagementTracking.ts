import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Engagement tracking is currently disabled to reduce Supabase Edge Function
 * load on the free tier. The hook still mounts so it can be re-enabled later
 * without changing call sites.
 *
 * Previously fired: TimeOnPage (30/60/120s), PageScroll (25/50/75/100%),
 * InternalClick — each posting to the meta-capi edge function.
 */
export const useEngagementTracking = () => {
  // No-op while keeping the hook signature stable.
  useLocation();
  useEffect(() => {
    return;
  }, []);
};
