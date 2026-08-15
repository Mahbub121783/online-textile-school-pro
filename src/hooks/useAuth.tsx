import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const avatarNormalizationInFlight = new Set<string>();
const profileCache = new Map<string, { at: number; data: { profile: any | null; roles: string[] } }>();
const PROFILE_CACHE_MS = 2 * 60 * 1000;

const isCloudinaryUrl = (url?: string | null) =>
  !!url && (url.includes('res.cloudinary.com') || url.includes('cloudinary.com'));

const shouldNormalizeAvatarUrl = (url?: string | null) =>
  !!url && /^https?:\/\//i.test(url) && !isCloudinaryUrl(url);

/**
 * Google profile thumbnails come at low res by default (e.g. `=s96-c` = 96px).
 * Upgrade to 400px before importing so the stored Cloudinary copy is sharp.
 */
const upgradeRemoteAvatarUrl = (url: string): string => {
  if (/googleusercontent\.com/.test(url)) {
    // Replace =s{N}-c (or similar) with =s400-c
    if (/=s\d+(-c)?/.test(url)) return url.replace(/=s\d+(-c)?/, '=s400-c');
    // Append size param if missing
    if (!url.includes('=s')) return `${url}${url.includes('?') ? '&' : '='}s400-c`;
  }
  return url;
};

const normalizeAvatarToCloudinary = async (userId: string, avatarUrl?: string | null) => {
  if (!shouldNormalizeAvatarUrl(avatarUrl) || avatarNormalizationInFlight.has(userId)) return null;

  avatarNormalizationInFlight.add(userId);
  try {
    const fileName = `avatar-${userId}`;
    const upgradedUrl = upgradeRemoteAvatarUrl(avatarUrl as string);
    const { data, error } = await supabase.functions.invoke('cloudinary-proxy', {
      body: {
        action: 'fetch-url',
        remote_url: upgradedUrl,
        file_name: fileName,
        file_type: 'image/jpeg',
      },
    });

    if (error || data?.error || !data?.url) return null;

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ avatar_url: data.url })
      .eq('id', userId);

    if (updateError) return null;
    return data.url as string;
  } catch {
    return null;
  } finally {
    avatarNormalizationInFlight.delete(userId);
  }
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isReady: boolean;
  authzLoading: boolean;
  profile: any | null;
  roles: string[];
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isReady: false,
  authzLoading: true,
  profile: null,
  roles: [],
  isSuperAdmin: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

// v3: invalidate older caches that may contain empty roles from transient DB failures
const PROFILE_LS_PREFIX = 'ots-auth-cache-v3:';

const readPersistedUserData = (userId: string): { profile: any | null; roles: string[] } | null => {
  try {
    const raw = localStorage.getItem(`${PROFILE_LS_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return { profile: parsed.profile ?? null, roles: Array.isArray(parsed.roles) ? parsed.roles : [] };
  } catch {
    return null;
  }
};

const writePersistedUserData = (userId: string, data: { profile: any | null; roles: string[] }) => {
  try {
    localStorage.setItem(`${PROFILE_LS_PREFIX}${userId}`, JSON.stringify(data));
  } catch { /* quota — ignore */ }
};

const fetchUserData = async (userId: string) => {
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.at < PROFILE_CACHE_MS) {
    return cached.data;
  }

  try {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]);
    const resolvedRoles = rolesRes.error ? null : (rolesRes.data?.map((r: any) => r.role) ?? []);

    // If profile or roles fetch errored OR returned null, do NOT poison the cache.
    // Fall back to last known good data so the UI keeps working, and retry next call.
    if (profileRes.error || !profileRes.data || rolesRes.error) {
      const persisted = readPersistedUserData(userId);
      if (persisted?.profile || persisted?.roles?.length) {
        const merged = {
          profile: profileRes.data ?? persisted?.profile ?? null,
          roles: resolvedRoles ?? persisted?.roles ?? [],
        };
        // Short TTL so we retry profile fetch soon
        profileCache.set(userId, { at: Date.now() - (PROFILE_CACHE_MS - 15_000), data: merged });
        return merged;
      }
      // No persisted fallback — return what we have, but DON'T cache it.
      if (!profileRes.error && profileRes.data) {
        return {
          profile: profileRes.data,
          roles: resolvedRoles ?? [],
        };
      }
      // No persisted fallback — return empty but DON'T cache it
      return {
        profile: null,
        roles: resolvedRoles ?? [],
      };
    }

    const data = {
      profile: profileRes.data,
      roles: resolvedRoles ?? [],
    };
    profileCache.set(userId, { at: Date.now(), data });
    writePersistedUserData(userId, data);
    return data;
  } catch (err) {
    // DB saturated / network down — fall back to last known good data so
    // the user still sees their dashboard instead of an infinite spinner.
    const persisted = readPersistedUserData(userId);
    if (persisted) {
      profileCache.set(userId, { at: Date.now(), data: persisted });
      return persisted;
    }
    throw err;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [authzLoading, setAuthzLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    const loginRecorded = new Set<string>();

    const recordLogin = (userId: string) => {
      if (loginRecorded.has(userId)) return;
      loginRecorded.add(userId);
      // Defer non-critical write so login UI never waits on it
      setTimeout(() => {
        supabase.from('user_profiles').update({ last_login_at: new Date().toISOString() }).eq('id', userId).then(() => {});
      }, 2000);
    };

    const loadProfileAndRoles = (uid: string) => {
      // Instant UI: hydrate from localStorage cache before DB even responds.
      const persisted = readPersistedUserData(uid);
      if (persisted && mounted) {
        setProfile(persisted.profile);
        setRoles(persisted.roles);
        if (persisted.roles.length > 0) setAuthzLoading(false);
      }
      setAuthzLoading(true);
      // Fire-and-forget refresh; UI is already unblocked
      fetchUserData(uid).then(d => {
        if (!mounted) return;
        // Don't overwrite a good cached profile with a transient null
        setProfile((prev: any) => d.profile ?? prev);
        setRoles(d.roles);
        const idle: any = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 5000));
        idle(() => {
          if (!mounted) return;
          normalizeAvatarToCloudinary(uid, d.profile?.avatar_url).then((normalizedUrl) => {
            if (!mounted || !normalizedUrl) return;
            setProfile((prev: any) => prev ? { ...prev, avatar_url: normalizedUrl } : prev);
          });
        });
      }).catch(() => {}).finally(() => {
        if (mounted) setAuthzLoading(false);
      });
    };

    // 1. Primary init — unblock UI as soon as session is known
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setIsReady(true);
      if (session?.user) {
        setAuthzLoading(true);
        loadProfileAndRoles(session.user.id);
      } else {
        setAuthzLoading(false);
      }
    }).catch(() => {
      if (mounted) { setLoading(false); setIsReady(true); setAuthzLoading(false); }
    });

    // 2. Listener — synchronous state update, defer DB work
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'INITIAL_SESSION') return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const uid = session.user.id;
          setAuthzLoading(true);
          if (event === 'SIGNED_IN') recordLogin(uid);
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            profileCache.delete(uid);
          }
          loadProfileAndRoles(uid);
        } else {
          setProfile(null);
          setRoles([]);
          setAuthzLoading(false);
        }
      }
    );

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  // Roles/profile used to only refresh on sign-in/token-refresh/page reload,
  // so when an admin granted/revoked a role, the AFFECTED user's own session
  // (sidebar, route guards, permissions) never found out until they manually
  // logged out and back in -- reported as "role change not reflecting live."
  // This 30s/focus poll stays as a fallback safety net (SSE connections can
  // drop), but the SSE effect below is what makes it actually instant.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const tick = () => { if (!cancelled) refreshProfile(); };
    const interval = setInterval(tick, 30000);
    window.addEventListener('focus', tick);
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener('focus', tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // True real-time push: now that this runs on our own Node+Postgres stack
  // (not funneled through a third-party realtime-channel quota), a genuine
  // server push is feasible. backend/src/realtime.js LISTENs for Postgres
  // NOTIFYs (fired by triggers in db/49) and forwards them over SSE to this
  // exact connection the moment an admin changes this user's roles/profile,
  // instead of waiting up to 30s for the poll above to catch up.
  useEffect(() => {
    const token = (session as any)?.access_token;
    if (!user || !token) return;
    const apiBase = import.meta.env.VITE_SUPABASE_URL || 'https://api.onlinetextileschool.com';
    const es = new EventSource(`${apiBase}/realtime/stream?token=${encodeURIComponent(token)}`);
    es.addEventListener('roles_changed', () => refreshProfile());
    es.addEventListener('profile_changed', () => refreshProfile());
    es.addEventListener('notification', () => {
      window.dispatchEvent(new CustomEvent('ots:notification'));
    });
    // EventSource retries automatically on drop/error -- no manual reconnect needed.
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, (session as any)?.access_token]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setAuthzLoading(false);
  };

  // profile/roles are plain useState, not react-query -- so a component
  // elsewhere doing queryClient.invalidateQueries() has no effect on them.
  // Anything that updates the current user's own row (e.g. linking a
  // campus, editing settings) needs this to see the change without a full
  // page reload.
  const refreshProfile = async () => {
    if (!user) return;
    profileCache.delete(user.id);
    const d = await fetchUserData(user.id);
    setProfile((prev: any) => d.profile ?? prev);
    setRoles(d.roles);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isReady, authzLoading, profile, roles, isSuperAdmin: roles.includes('super_admin'), signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
