import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

export type CookieCategory = 'necessary' | 'functional' | 'analytics' | 'marketing';

export interface CookieConsent {
  necessary: true; // always true, cannot be disabled
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: string;
}

const STORAGE_KEY = 'cookie_consent_v1';
const CONSENT_VERSION = '1.0.0';
// Re-prompt after 12 months (GDPR best practice)
const CONSENT_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000;

const defaultConsent: CookieConsent = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
  timestamp: '',
  version: CONSENT_VERSION,
};

interface CookieConsentContextType {
  consent: CookieConsent | null;
  hasDecided: boolean;
  showBanner: boolean;
  showPreferences: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (prefs: Partial<Omit<CookieConsent, 'necessary' | 'timestamp' | 'version'>>) => void;
  openPreferences: () => void;
  closePreferences: () => void;
  resetConsent: () => void;
  isAllowed: (category: CookieCategory) => boolean;
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

const loadConsent = (): CookieConsent | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    // Invalidate if version mismatch or expired
    if (parsed.version !== CONSENT_VERSION) return null;
    const ts = new Date(parsed.timestamp).getTime();
    if (!ts || Date.now() - ts > CONSENT_EXPIRY_MS) return null;
    return { ...parsed, necessary: true };
  } catch {
    return null;
  }
};

const saveConsent = (consent: CookieConsent) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    // Dispatch event for other tabs / listeners
    window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: consent }));
  } catch (e) {
    console.warn('Cookie consent could not be saved', e);
  }
};

export const CookieConsentProvider = ({ children }: { children: ReactNode }) => {
  const [consent, setConsent] = useState<CookieConsent | null>(() => loadConsent());
  const [showPreferences, setShowPreferences] = useState(false);

  const hasDecided = consent !== null;
  const showBanner = !hasDecided;

  // Sync between tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setConsent(loadConsent());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const acceptAll = useCallback(() => {
    const newConsent: CookieConsent = {
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    saveConsent(newConsent);
    setConsent(newConsent);
    setShowPreferences(false);
  }, []);

  const rejectAll = useCallback(() => {
    const newConsent: CookieConsent = {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    saveConsent(newConsent);
    setConsent(newConsent);
    setShowPreferences(false);
  }, []);

  const savePreferences = useCallback((prefs: Partial<Omit<CookieConsent, 'necessary' | 'timestamp' | 'version'>>) => {
    const newConsent: CookieConsent = {
      necessary: true,
      functional: prefs.functional ?? consent?.functional ?? false,
      analytics: prefs.analytics ?? consent?.analytics ?? false,
      marketing: prefs.marketing ?? consent?.marketing ?? false,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    saveConsent(newConsent);
    setConsent(newConsent);
    setShowPreferences(false);
  }, [consent]);

  const openPreferences = useCallback(() => setShowPreferences(true), []);
  const closePreferences = useCallback(() => setShowPreferences(false), []);

  const resetConsent = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setConsent(null);
    setShowPreferences(false);
  }, []);

  const isAllowed = useCallback(
    (category: CookieCategory) => {
      if (category === 'necessary') return true;
      return consent?.[category] === true;
    },
    [consent]
  );

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        hasDecided,
        showBanner,
        showPreferences,
        acceptAll,
        rejectAll,
        savePreferences,
        openPreferences,
        closePreferences,
        resetConsent,
        isAllowed,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
};

export const useCookieConsent = () => {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error('useCookieConsent must be used within CookieConsentProvider');
  return ctx;
};
