import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type ViolationType =
  | 'tab_blur'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'right_click'
  | 'session_resumed'
  | 'devtools_suspected'
  | 'focus_mode_entered';

const FRIENDLY: Record<ViolationType, string> = {
  tab_blur: 'You switched tabs',
  window_blur: 'You left the window',
  fullscreen_exit: 'You exited focus mode',
  copy_attempt: 'Copying is disabled',
  paste_attempt: 'Pasting is disabled',
  right_click: 'Right-click is disabled',
  session_resumed: 'Session resumed after refresh',
  devtools_suspected: 'Developer tools detected',
  focus_mode_entered: 'Entered focus mode',
};

interface Options {
  sessionId: string | undefined;
  enabled: boolean;
  showToasts?: boolean;
}

interface QueuedEvent { type: ViolationType; metadata: Record<string, unknown>; at: number }

const FLUSH_INTERVAL_MS = 30_000;
const FLUSH_THRESHOLD = 5;

/**
 * Free-tier hardening: integrity events are queued client-side and flushed
 * in batches (≤5 events or every 30s) via `qb_log_violations_batch`,
 * collapsing what used to be one RPC per event into one RPC per batch.
 */
export function useExamIntegrity({ sessionId, enabled, showToasts = true }: Options) {
  const [count, setCount] = useState(0);
  const [events, setEvents] = useState<{ type: ViolationType; at: number }[]>([]);
  const lastFiredRef = useRef<Record<string, number>>({});
  const queueRef = useRef<QueuedEvent[]>([]);

  const flush = useCallback(async () => {
    if (!sessionId || queueRef.current.length === 0) return;
    const batch = queueRef.current.splice(0, queueRef.current.length);
    try {
      await supabase.rpc('qb_log_violations_batch', {
        _session_id: sessionId,
        _events: batch.map((e) => ({ type: e.type, metadata: e.metadata })) as never,
      });
    } catch {
      /* swallow — never block exam */
    }
  }, [sessionId]);

  const log = useCallback(
    (type: ViolationType, metadata: Record<string, unknown> = {}) => {
      if (!sessionId) return;
      const now = Date.now();
      // Debounce identical events within 2s
      if (lastFiredRef.current[type] && now - lastFiredRef.current[type] < 2000) return;
      lastFiredRef.current[type] = now;

      const isInfo = type === 'session_resumed' || type === 'focus_mode_entered';
      if (!isInfo) setCount((c) => c + 1);
      setEvents((e) => [...e, { type, at: now }]);

      if (showToasts && !isInfo) {
        toast({
          title: `⚠ Warning: ${FRIENDLY[type]}`,
          description: 'Your activity is being recorded for integrity.',
          variant: 'destructive',
        });
      }

      queueRef.current.push({ type, metadata, at: now });
      if (queueRef.current.length >= FLUSH_THRESHOLD) flush();
    },
    [sessionId, showToasts, flush],
  );

  // Periodic flush + flush on unmount/pagehide
  useEffect(() => {
    if (!enabled || !sessionId) return;
    const iv = setInterval(flush, FLUSH_INTERVAL_MS);
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(iv);
      window.removeEventListener('pagehide', onHide);
      flush();
    };
  }, [enabled, sessionId, flush]);

  // Tab visibility / window blur / fullscreen / copy-paste-rightclick
  useEffect(() => {
    if (!enabled || !sessionId) return;

    const onVis = () => {
      if (document.visibilityState === 'hidden') log('tab_blur');
    };
    const onBlur = () => log('window_blur');
    const onFsChange = () => {
      if (!document.fullscreenElement) log('fullscreen_exit');
    };
    const onCopy = (e: ClipboardEvent) => { e.preventDefault(); log('copy_attempt'); };
    const onPaste = (e: ClipboardEvent) => { e.preventDefault(); log('paste_attempt'); };
    const onContext = (e: MouseEvent) => { e.preventDefault(); log('right_click'); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a', 'p', 's'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        log(e.key.toLowerCase() === 'v' ? 'paste_attempt' : 'copy_attempt');
      }
    };

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('keydown', onKey);
    };
  }, [enabled, sessionId, log]);

  return { count, events, log };
}
