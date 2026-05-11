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

export function useExamIntegrity({ sessionId, enabled, showToasts = true }: Options) {
  const [count, setCount] = useState(0);
  const [events, setEvents] = useState<{ type: ViolationType; at: number }[]>([]);
  const lastFiredRef = useRef<Record<string, number>>({});

  const log = useCallback(
    async (type: ViolationType, metadata: Record<string, unknown> = {}) => {
      if (!sessionId) return;
      // Debounce identical events within 2s
      const now = Date.now();
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

      try {
        await supabase.rpc('qb_log_violation', {
          _session_id: sessionId,
          _type: type,
          _metadata: metadata as never,
        });
      } catch {
        /* swallow — never block exam */
      }
    },
    [sessionId, showToasts],
  );

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
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      log('copy_attempt');
    };
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      log('paste_attempt');
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      log('right_click');
    };
    const onKey = (e: KeyboardEvent) => {
      // Block common cheat shortcuts
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
