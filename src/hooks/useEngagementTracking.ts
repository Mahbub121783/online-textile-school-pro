import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackMetaEvent } from '@/lib/metaPixel';

/**
 * Global engagement tracker:
 * - TimeOnPage at 30s / 60s / 120s
 * - PageScroll at 25 / 50 / 75 / 100 %
 * - InternalClick on internal anchor clicks
 *
 * Resets all timers and milestones on every route change.
 */
export const useEngagementTracking = () => {
  const location = useLocation();
  const milestoneRef = useRef({ time: new Set<number>(), scroll: new Set<number>() });
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    // Reset state for new page
    milestoneRef.current = { time: new Set(), scroll: new Set() };
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];

    const page = location.pathname + location.search;

    // ---- TimeOnPage ----
    [30, 60, 120].forEach((sec) => {
      const id = window.setTimeout(() => {
        if (!milestoneRef.current.time.has(sec)) {
          milestoneRef.current.time.add(sec);
          trackMetaEvent('TimeOnPage', { duration_seconds: sec, page });
        }
      }, sec * 1000);
      timersRef.current.push(id);
    });

    // ---- PageScroll ----
    const onScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      if (docH <= 0) return;
      const pct = Math.round((scrollTop / docH) * 100);
      [25, 50, 75, 100].forEach((m) => {
        if (pct >= m && !milestoneRef.current.scroll.has(m)) {
          milestoneRef.current.scroll.add(m);
          trackMetaEvent('PageScroll', { percent: m, page });
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // ---- InternalClick ----
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      // Only internal links (relative or same origin)
      const isInternal =
        href.startsWith('/') ||
        href.startsWith('#') ||
        (href.startsWith(window.location.origin));
      if (!isInternal) return;
      trackMetaEvent('InternalClick', {
        href,
        text: (anchor.innerText || '').trim().slice(0, 80),
        from: page,
      });
    };
    document.addEventListener('click', onClick, { capture: true });

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick, { capture: true } as any);
    };
  }, [location.pathname, location.search]);
};
