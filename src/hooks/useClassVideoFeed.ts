import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ClassVideo } from '@/hooks/useClassVideos';

const BATCH_SIZE = 6;

interface FeedState {
  videos: ClassVideo[];
  loading: boolean;
  initialLoading: boolean;
  exhausted: boolean;
  phase: 'category' | 'global' | 'done';
}

/**
 * Reel-style feed hook.
 * - Loads start video (by slug) first
 * - Then appends same-category videos (newest)
 * - When category exhausted, appends global videos (newest)
 * - Dedups by id
 */
export function useClassVideoFeed(startSlug: string | undefined) {
  const [state, setState] = useState<FeedState>({
    videos: [],
    loading: false,
    initialLoading: true,
    exhausted: false,
    phase: 'category',
  });

  // Bootstrap: fetch start video, then first batch
  useEffect(() => {
    if (!startSlug) return;
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, initialLoading: true, videos: [], exhausted: false, phase: 'category' }));

      const { data: start } = await supabase
        .from('class_videos')
        .select('*, video_categories(*)')
        .eq('slug', startSlug)
        .eq('is_published', true)
        .maybeSingle();

      if (cancelled) return;
      if (!start) {
        setState((s) => ({ ...s, initialLoading: false, exhausted: true, phase: 'done' }));
        return;
      }

      const startVideo = start as ClassVideo;
      const initial: ClassVideo[] = [startVideo];

      // Same-category batch (excluding start)
      let phase: FeedState['phase'] = 'category';
      let exhausted = false;

      if (startVideo.category_id) {
        const { data: cat } = await supabase
          .from('class_videos')
          .select('*, video_categories(*)')
          .eq('is_published', true)
          .eq('category_id', startVideo.category_id)
          .neq('id', startVideo.id)
          .order('created_at', { ascending: false })
          .limit(BATCH_SIZE);
        if (cat && cat.length > 0) {
          initial.push(...(cat as ClassVideo[]));
        }
        if (!cat || cat.length < BATCH_SIZE) {
          phase = 'global';
        }
      } else {
        phase = 'global';
      }

      // If still room (or no category), pull global
      if (phase === 'global') {
        const excludeIds = initial.map((v) => v.id);
        const { data: glob } = await supabase
          .from('class_videos')
          .select('*, video_categories(*)')
          .eq('is_published', true)
          .not('id', 'in', `(${excludeIds.join(',')})`)
          .order('created_at', { ascending: false })
          .limit(BATCH_SIZE);
        if (glob && glob.length > 0) {
          initial.push(...(glob as ClassVideo[]));
        }
        if (!glob || glob.length < BATCH_SIZE) {
          exhausted = true;
          phase = 'done';
        }
      }

      if (cancelled) return;
      setState({
        videos: dedup(initial),
        loading: false,
        initialLoading: false,
        exhausted,
        phase,
      });
    })();
    return () => { cancelled = true; };
  }, [startSlug]);

  const loadMore = useCallback(async () => {
    setState((prev) => {
      if (prev.loading || prev.exhausted || prev.initialLoading) return prev;
      // Trigger async work outside the setter
      (async () => {
        const cur = prev;
        const start = cur.videos[0];
        const excludeIds = cur.videos.map((v) => v.id);

        let appended: ClassVideo[] = [];
        let phase = cur.phase;
        let exhausted = false;

        if (phase === 'category' && start?.category_id) {
          const { data } = await supabase
            .from('class_videos')
            .select('*, video_categories(*)')
            .eq('is_published', true)
            .eq('category_id', start.category_id)
            .not('id', 'in', `(${excludeIds.join(',')})`)
            .order('created_at', { ascending: false })
            .limit(BATCH_SIZE);
          appended = (data ?? []) as ClassVideo[];
          if (appended.length < BATCH_SIZE) phase = 'global';
        }

        if (phase === 'global' && appended.length < BATCH_SIZE) {
          const allExclude = [...excludeIds, ...appended.map((v) => v.id)];
          const { data } = await supabase
            .from('class_videos')
            .select('*, video_categories(*)')
            .eq('is_published', true)
            .not('id', 'in', `(${allExclude.join(',')})`)
            .order('created_at', { ascending: false })
            .limit(BATCH_SIZE - appended.length);
          const more = (data ?? []) as ClassVideo[];
          appended = [...appended, ...more];
          if (more.length === 0) {
            exhausted = true;
            phase = 'done';
          }
        }

        setState((s) => ({
          ...s,
          videos: dedup([...s.videos, ...appended]),
          loading: false,
          exhausted: exhausted || appended.length === 0,
          phase,
        }));
      })();
      return { ...prev, loading: true };
    });
  }, []);

  return {
    videos: state.videos,
    loadMore,
    isLoading: state.loading,
    initialLoading: state.initialLoading,
    exhausted: state.exhausted,
  };
}

function dedup(arr: ClassVideo[]): ClassVideo[] {
  const seen = new Set<string>();
  const out: ClassVideo[] = [];
  for (const v of arr) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    out.push(v);
  }
  return out;
}
