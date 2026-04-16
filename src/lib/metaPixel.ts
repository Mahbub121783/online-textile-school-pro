/**
 * Meta Pixel + Conversions API helper.
 * Fires events both browser-side (fbq) and server-side (CAPI edge function)
 * with a shared event_id so Meta deduplicates the pair.
 *
 * Respects cookie consent: only fires when user has accepted "marketing"
 * (unless require-consent flag is disabled, e.g. for admin testing).
 */
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
    __META_PIXEL_ID__?: string;
    __META_PIXEL_TEST_CODE__?: string;
    __META_PIXEL_ENABLED__?: boolean;
    __META_PIXEL_REQUIRE_CONSENT__?: boolean;
    __META_PIXEL_LAST_EVENT__?: { name: string; at: string; eventId: string } | null;
    __metaPixelDebug?: () => void;
    __metaPixelDiagnostic?: () => Promise<any>;
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
  if (window.__META_PIXEL_ENABLED__ === false) {
    console.debug('[MetaPixel] blocked — pixel disabled', { eventName });
    return;
  }
  const requireConsent = window.__META_PIXEL_REQUIRE_CONSENT__ !== false;
  if (requireConsent && !hasMarketingConsent()) {
    console.debug('[MetaPixel] blocked — marketing consent not granted', { eventName });
    return;
  }

  const eventId = uuid();
  const isStandard = STANDARD_EVENTS.includes(eventName);

  // 1. Browser-side fbq
  let fbqFired = false;
  try {
    if (typeof window.fbq === 'function') {
      window.fbq(isStandard ? 'track' : 'trackCustom', eventName, params, { eventID: eventId });
      fbqFired = true;
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
    supabase.functions.invoke('meta-capi', { body: payload }).catch(() => {});
  } catch {
    // silent
  }

  window.__META_PIXEL_LAST_EVENT__ = { name: eventName, at: new Date().toISOString(), eventId };
  console.debug('[MetaPixel] fired', { eventName, eventId, fbqFired, params });
};

/** Configure pixel runtime values from settings/admin */
export const configureMetaPixel = (opts: {
  pixelId?: string;
  testCode?: string;
  enabled?: boolean;
  requireConsent?: boolean;
}) => {
  if (typeof window === 'undefined') return;
  if (opts.pixelId) window.__META_PIXEL_ID__ = opts.pixelId;
  if (opts.testCode !== undefined) window.__META_PIXEL_TEST_CODE__ = opts.testCode;
  if (opts.enabled !== undefined) window.__META_PIXEL_ENABLED__ = opts.enabled;
  if (opts.requireConsent !== undefined) window.__META_PIXEL_REQUIRE_CONSENT__ = opts.requireConsent;
};

/** Run a full diagnostic — returns table of checks for admin UI */
export interface DiagnosticResult {
  check: string;
  ok: boolean;
  detail: string;
}

export const runMetaPixelDiagnostic = async (): Promise<DiagnosticResult[]> => {
  const out: DiagnosticResult[] = [];

  // 1. Pixel ID configured
  const pid = typeof window !== 'undefined' ? window.__META_PIXEL_ID__ : undefined;
  out.push({ check: 'Pixel ID configured', ok: !!pid, detail: pid || 'missing' });

  // 2. Pixel enabled
  const enabled = typeof window !== 'undefined' ? window.__META_PIXEL_ENABLED__ !== false : false;
  out.push({ check: 'Pixel enabled', ok: enabled, detail: enabled ? 'yes' : 'disabled in admin' });

  // 3. fbq script loaded
  const fbqLoaded = typeof window !== 'undefined' && typeof window.fbq === 'function';
  out.push({
    check: 'Browser fbq() loaded',
    ok: fbqLoaded,
    detail: fbqLoaded ? 'loaded' : 'NOT loaded — likely blocked by ad-blocker (CAPI still works)',
  });

  // 4. Marketing consent
  const consent = hasMarketingConsent();
  const requireConsent = typeof window !== 'undefined' ? window.__META_PIXEL_REQUIRE_CONSENT__ !== false : true;
  out.push({
    check: 'Marketing consent',
    ok: consent || !requireConsent,
    detail: consent ? 'granted' : requireConsent ? 'NOT granted (events blocked)' : 'not required (override on)',
  });

  // 5. Test event code
  const tc = typeof window !== 'undefined' ? window.__META_PIXEL_TEST_CODE__ : '';
  out.push({
    check: 'Test event code',
    ok: true,
    detail: tc ? `${tc} (events appear in Test Events tab)` : 'empty (live campaign data)',
  });

  // 6. Browser event fire
  const eid = uuid();
  let browserOk = false;
  try {
    if (fbqLoaded) {
      window.fbq!('track', 'PageView', { diagnostic: true }, { eventID: eid });
      browserOk = true;
    }
  } catch {}
  out.push({
    check: 'Browser PageView fire',
    ok: browserOk,
    detail: browserOk ? `eventID ${eid.slice(0, 8)}…` : 'fbq missing',
  });

  // 7. CAPI reachability
  let capiOk = false;
  let capiDetail = '';
  try {
    const { data, error } = await supabase.functions.invoke('meta-capi', {
      body: {
        event_name: 'PageView',
        event_id: eid,
        event_source_url: typeof window !== 'undefined' ? window.location.href : '',
        custom_data: { diagnostic: true },
        user_data: {
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
          client_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        },
        test_event_code: tc || undefined,
      },
    });
    if (error) {
      capiDetail = error.message;
    } else {
      capiOk = (data as any)?.events_received >= 1 || (data as any)?.success === true;
      capiDetail = JSON.stringify(data);
    }
  } catch (e: any) {
    capiDetail = e?.message || 'invoke failed';
  }
  out.push({ check: 'CAPI server send', ok: capiOk, detail: capiDetail.slice(0, 120) });

  return out;
};

// Expose debug helper on window
if (typeof window !== 'undefined') {
  window.__metaPixelDebug = () => {
    console.log('[MetaPixel] state', {
      pixelId: window.__META_PIXEL_ID__,
      enabled: window.__META_PIXEL_ENABLED__,
      requireConsent: window.__META_PIXEL_REQUIRE_CONSENT__,
      testCode: window.__META_PIXEL_TEST_CODE__,
      fbqLoaded: typeof window.fbq === 'function',
      consent: hasMarketingConsent(),
      lastEvent: window.__META_PIXEL_LAST_EVENT__,
    });
  };
  window.__metaPixelDiagnostic = runMetaPixelDiagnostic;
}
