import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PopupRow {
  id: string;
  name: string;
  is_active: boolean;
  type: string;
  title: string | null;
  subtitle: string | null;
  body_content: string | null;
  image_url: string | null;
  video_url: string | null;
  background_color: string | null;
  text_color: string | null;
  accent_color: string | null;
  cta_primary_label: string | null;
  cta_primary_url: string | null;
  cta_secondary_label: string | null;
  cta_secondary_url: string | null;
  layout: string;
  size: string;
  animation: string;
  trigger_type: string;
  trigger_value: number;
  target_pages: string[] | null;
  exclude_pages: string[] | null;
  target_devices: string;
  target_user_state: string;
  frequency: string;
  frequency_value: number | null;
  start_date: string | null;
  end_date: string | null;
  countdown_target_date: string | null;
  form_fields: any;
  priority: number;
  background_video_url?: string | null;
  background_video_overlay_opacity?: number | null;
  countdown_source?: string | null;
  countdown_source_id?: string | null;
  countdown_source_field?: string | null;
  countdown_expired_action?: string | null;
  countdown_expired_message?: string | null;
}

const SESSION_KEY = 'popup_session_id';
const getSessionId = () => {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
};

const matchPath = (pattern: string, path: string): boolean => {
  if (pattern === path) return true;
  if (pattern.endsWith('/*')) {
    return path.startsWith(pattern.slice(0, -2));
  }
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(path);
  }
  return false;
};

const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

const getFreqKey = (id: string) => `popup_seen_${id}`;

const checkFrequency = (popup: PopupRow): boolean => {
  const key = getFreqKey(popup.id);
  const last = localStorage.getItem(key);
  if (!last) return true;
  const lastTime = parseInt(last, 10);
  if (popup.frequency === 'once') return false;
  if (popup.frequency === 'every_visit') return true;
  if (popup.frequency === 'every_n_days') {
    const days = popup.frequency_value || 1;
    return Date.now() - lastTime > days * 24 * 60 * 60 * 1000;
  }
  return true;
};

const markSeen = (id: string) => {
  localStorage.setItem(getFreqKey(id), String(Date.now()));
};

const trackEvent = async (popupId: string, eventType: string, userId: string | null, path: string) => {
  try {
    await supabase.from('popup_analytics').insert({
      popup_id: popupId,
      event_type: eventType,
      user_id: userId,
      session_id: getSessionId(),
      page_path: path,
    });
  } catch (e) {
    console.error('popup track failed', e);
  }
};

export function usePopupEngine() {
  const location = useLocation();
  const { user } = useAuth();
  const [activePopup, setActivePopup] = useState<PopupRow | null>(null);
  const [eligible, setEligible] = useState<PopupRow[]>([]);
  const triggerCleanup = useRef<(() => void) | null>(null);
  const shownRef = useRef<Set<string>>(new Set());

  // Cache popup config in module scope so we only hit Supabase once per session
  // (popup config changes are rare; reduces free-tier load significantly).
  useEffect(() => {
    let cancelled = false;
    const fetchPopups = async () => {
      const now = new Date().toISOString();
      const cache = (window as any).__popupCache as { at: number; data: PopupRow[] } | undefined;
      let data: PopupRow[] | null = null;
      if (cache && Date.now() - cache.at < 5 * 60 * 1000) {
        data = cache.data;
      } else {
        const res = await supabase
          .from('popups')
          .select('*')
          .eq('is_active', true)
          .order('priority', { ascending: false });
        if (res.error || !res.data) return;
        data = res.data as PopupRow[];
        (window as any).__popupCache = { at: Date.now(), data };
      }
      if (cancelled || !data) return;

      const path = location.pathname;
      const userState = user ? 'logged_in' : 'guest';
      const device = isMobile() ? 'mobile' : 'desktop';

      const matching = data.filter(p => {
        if (p.start_date && p.start_date > now) return false;
        if (p.end_date && p.end_date < now) return false;
        if (p.target_user_state !== 'all' && p.target_user_state !== userState) return false;
        if (p.target_devices !== 'all' && p.target_devices !== device) return false;
        const targets = p.target_pages?.length ? p.target_pages : ['/*'];
        const excludes = p.exclude_pages || [];
        if (excludes.some(ex => matchPath(ex, path))) return false;
        if (!targets.some(t => matchPath(t, path))) return false;
        if (!checkFrequency(p)) return false;
        if (shownRef.current.has(p.id)) return false;
        return true;
      });
      setEligible(matching);
    };
    fetchPopups();
    return () => { cancelled = true; };
  }, [location.pathname, user]);

  // Setup trigger for top eligible popup
  useEffect(() => {
    triggerCleanup.current?.();
    triggerCleanup.current = null;
    if (activePopup || eligible.length === 0) return;

    const popup = eligible[0];
    const fire = () => {
      shownRef.current.add(popup.id);
      markSeen(popup.id);
      setActivePopup(popup);
      trackEvent(popup.id, 'view', user?.id || null, location.pathname);
    };

    if (popup.trigger_type === 'on_load') {
      fire();
    } else if (popup.trigger_type === 'delay' || popup.trigger_type === 'time_on_page') {
      const t = setTimeout(fire, (popup.trigger_value || 3) * 1000);
      triggerCleanup.current = () => clearTimeout(t);
    } else if (popup.trigger_type === 'scroll_percent') {
      const onScroll = () => {
        const scrolled = (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100;
        if (scrolled >= (popup.trigger_value || 50)) {
          fire();
          window.removeEventListener('scroll', onScroll);
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      triggerCleanup.current = () => window.removeEventListener('scroll', onScroll);
    } else if (popup.trigger_type === 'exit_intent') {
      const onLeave = (e: MouseEvent) => {
        if (e.clientY < 10) {
          fire();
          document.removeEventListener('mouseleave', onLeave);
        }
      };
      document.addEventListener('mouseleave', onLeave);
      triggerCleanup.current = () => document.removeEventListener('mouseleave', onLeave);
    }
    return () => triggerCleanup.current?.();
  }, [eligible, activePopup, user, location.pathname]);

  const close = (reason: 'dismiss' | 'cta_primary' | 'cta_secondary' | 'submit' = 'dismiss') => {
    if (activePopup) {
      const eventType = reason === 'cta_primary' ? 'click_primary' : reason === 'cta_secondary' ? 'click_secondary' : reason;
      trackEvent(activePopup.id, eventType, user?.id || null, location.pathname);
    }
    setActivePopup(null);
  };

  return { activePopup, close };
}
