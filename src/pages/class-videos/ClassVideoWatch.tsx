import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useClassVideoFeed } from '@/hooks/useClassVideoFeed';
import ReelSlot from '@/components/class-videos/ReelSlot';
import CommentsSheet from '@/components/class-videos/CommentsSheet';
import SEOHead from '@/components/SEOHead';

export default function ClassVideoWatch() {
  const { slug } = useParams<{ slug: string }>();
  const { videos, loadMore, initialLoading, exhausted } = useClassVideoFeed(slug);

  const containerRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [muted, setMuted] = useState(true); // start muted to satisfy autoplay

  // Set ref helper
  const setSlotRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) slotRefs.current.set(id, el);
    else slotRefs.current.delete(id);
  };

  // IntersectionObserver to track active slot
  useEffect(() => {
    if (videos.length === 0) return;
    const root = containerRef.current;
    if (!root) return;

    const io = new IntersectionObserver(
      (entries) => {
        // Pick the entry with highest intersection ratio that is at least 0.6
        let best: { idx: number; ratio: number } | null = null;
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.videoId;
          if (!id) return;
          const idx = videos.findIndex((v) => v.id === id);
          if (idx < 0) return;
          if (entry.intersectionRatio >= 0.6 && (!best || entry.intersectionRatio > best.ratio)) {
            best = { idx, ratio: entry.intersectionRatio };
          }
        });
        if (best) {
          setActiveIndex((cur) => (cur === best!.idx ? cur : best!.idx));
        }
      },
      { root, threshold: [0, 0.4, 0.6, 0.8, 1] }
    );

    slotRefs.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [videos]);

  // URL sync (replaceState — no remount)
  useEffect(() => {
    const v = videos[activeIndex];
    if (!v) return;
    if (v.slug !== slug) {
      window.history.replaceState({}, '', `/class-videos/${v.slug}`);
    }
  }, [activeIndex, videos, slug]);

  // Trigger loadMore when within last 2 of feed
  useEffect(() => {
    if (exhausted) return;
    if (videos.length === 0) return;
    if (activeIndex >= videos.length - 3) {
      loadMore();
    }
  }, [activeIndex, videos.length, exhausted, loadMore]);

  // Advance handler — scroll to next slot
  const advance = (currentId: string) => {
    const idx = videos.findIndex((v) => v.id === currentId);
    const next = videos[idx + 1];
    if (!next) {
      loadMore();
      return;
    }
    const el = slotRefs.current.get(next.id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const activeVideo = videos[activeIndex];
  const seo = useMemo(() => activeVideo || videos[0], [activeVideo, videos]);

  if (!initialLoading && videos.length === 0) {
    return <Navigate to="/class-videos" replace />;
  }

  return (
    <>
      {seo && (
        <SEOHead
          title={`${seo.title} — Class Videos`}
          description={seo.description?.slice(0, 160) || `Watch ${seo.title} on Online Textile School`}
          ogImage={seo.thumbnail_url || undefined}
        />
      )}

      <div
        ref={containerRef}
        className="fixed inset-0 z-50 bg-black overflow-y-auto snap-y snap-mandatory overscroll-y-contain"
        style={{ scrollbarWidth: 'none' }}
      >
        <style>{`
          .reel-feed::-webkit-scrollbar { display: none; }
        `}</style>

        {initialLoading && (
          <div className="h-[100dvh] flex items-center justify-center text-white/70">
            Loading videos...
          </div>
        )}

        {videos.map((v, i) => (
          <ReelSlot
            key={v.id}
            ref={setSlotRef(v.id)}
            video={v}
            index={i}
            isActive={i === activeIndex}
            onCommentClick={() => setCommentsFor(v.id)}
            onAdvance={() => advance(v.id)}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
          />
        ))}

        {!exhausted && videos.length > 0 && (
          <div className="h-20 flex items-center justify-center text-white/40 text-xs">
            Loading more...
          </div>
        )}
        {exhausted && videos.length > 0 && (
          <div className="h-20 flex items-center justify-center text-white/40 text-xs">
            You've reached the end
          </div>
        )}
      </div>

      <CommentsSheet
        videoId={commentsFor}
        open={!!commentsFor}
        onOpenChange={(o) => { if (!o) setCommentsFor(null); }}
      />
    </>
  );
}
