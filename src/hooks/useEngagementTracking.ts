import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackMetaEvent } from '@/lib/metaPixel';

/**
 * Lightweight engagement tracking — only InternalClick is enabled.
 * Heavy events (TimeOnPage, PageScroll) remain disabled to protect the
 * Supabase free-tier edge function quota.
 */
export const useEngagementTracking = () => {
  useLocation();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const link = target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href) return;
      // Internal links only
      if (href.startsWith('http') && !href.includes(location.host)) return;
      try {
        trackMetaEvent('InternalClick', {
          link_url: href,
          link_text: (link.textContent || '').trim().slice(0, 80),
          page_path: location.pathname,
        });
      } catch { /* no-op */ }
    };
    document.addEventListener('click', handler, { passive: true });
    return () => document.removeEventListener('click', handler);
  }, []);
};
