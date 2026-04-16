/**
 * Meta Pixel + Conversions API helper.
 * Fires events both browser-side (fbq) and server-side (CAPI edge function)
 * with a shared event_id so Meta deduplicates the pair.
 *
 * Respects cookie consent: only fires when user has accepted "marketing".
 */
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
    __META_PIXEL_ID__?: string;
    __META_PIXEL_TEST_CODE__?: string;
    __META_PIXEL_ENABLED__?: boolean;
  }
}

export type MetaEventName =
  | 'PageView'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'TimeOnPage'
  | 'PageScroll'
  | 'WatchVideo'
  | 'InternalClick';

const STANDARD_EVENTS: MetaEventName[] = ['PageView', 'AddToCart', 'InitiateCheckout', 'Purchase'];

const uuid = () =>
  typeof crypto !== 'undefined' && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : undefined;
};

const hasMarketingConsent = (): boolean => {
  try {
    const raw = localStorage.getItem('cookie_consent_v1');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed?.marketing === true;
  } catch {
    return false;
  }
};

interface UserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  externalId?: string;
}

/**
 * Track a single Meta event.
 * Fires browser (fbq) + server (CAPI) with shared event_id.
 */
export const trackMetaEvent = (
  eventName: MetaEventName,
  params: Record<string, any> = {},
  userData?: UserData,
) => {
  if (typeof window === 'undefined') return;
  if (window.__META_PIXEL_ENABLED__ === false) return;
  if (!hasMarketingConsent()) return;

  const eventId = uuid();
  const isStandard = STANDARD_EVENTS.includes(eventName);

  // 1. Browser-side fbq
  try {
    if (typeof window.fbq === 'function') {
      window.fbq(isStandard ? 'track' : 'trackCustom', eventName, params, { eventID: eventId });
    }
  } catch (e) {
    // silent
  }

  // 2. Server-side CAPI mirror
  try {
    const payload = {
      event_name: eventName,
      event_id: eventId,
      event_source_url: window.location.href,
      custom_data: params,
      user_data: {
        ...userData,
        fbp: getCookie('_fbp'),
        fbc: getCookie('_fbc'),
        client_user_agent: navigator.userAgent,
      },
      test_event_code: window.__META_PIXEL_TEST_CODE__ || undefined,
    };
    // Fire-and-forget — never block UI
    supabase.functions.invoke('meta-capi', { body: payload }).catch(() => {});
  } catch {
    // silent
  }
};

/** Convenience: configure pixel runtime values from settings/admin */
export const configureMetaPixel = (opts: { pixelId?: string; testCode?: string; enabled?: boolean }) => {
  if (typeof window === 'undefined') return;
  if (opts.pixelId) window.__META_PIXEL_ID__ = opts.pixelId;
  if (opts.testCode !== undefined) window.__META_PIXEL_TEST_CODE__ = opts.testCode;
  if (opts.enabled !== undefined) window.__META_PIXEL_ENABLED__ = opts.enabled;
};
