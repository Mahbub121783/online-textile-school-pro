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
  profile: any | null;
  roles: string[];
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isReady: false,
  profile: null,
  roles: [],
  isSuperAdmin: false,
  signOut: async () => {},
});

// v2: bumped to invalidate any poisoned (null-profile) caches from previous version
const PROFILE_LS_PREFIX = 'ots-auth-cache-v2:';

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

    // If profile fetch errored OR returned null, do NOT poison the cache.
    // Fall back to last known good data so the UI keeps working, and retry next call.
    if (profileRes.error || !profileRes.data) {
      const persisted = readPersistedUserData(userId);
      if (persisted?.profile) {
        // Refresh roles if we got them, keep good profile
        const merged = {
          profile: persisted.profile,
          roles: rolesRes.data?.map((r: any) => r.role) ?? persisted.roles,
        };
        // Short TTL so we retry profile fetch soon
        profileCache.set(userId, { at: Date.now() - (PROFILE_CACHE_MS - 15_000), data: merged });
        return merged;
      }
      // No persisted fallback — return empty but DON'T cache it
      return {
        profile: null,
        roles: rolesRes.data?.map((r: any) => r.role) ?? [],
      };
    }

    const data = {
      profile: profileRes.data,
      roles: rolesRes.data?.map((r: any) => r.role) ?? [],
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
      }
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
      }).catch(() => {});
    };

    // 1. Primary init — unblock UI as soon as session is known
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setIsReady(true);
      if (session?.user) loadProfileAndRoles(session.user.id);
    }).catch(() => {
      if (mounted) { setLoading(false); setIsReady(true); }
    });

    // 2. Listener — synchronous state update, defer DB work
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'INITIAL_SESSION') return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const uid = session.user.id;
          if (event === 'SIGNED_IN') recordLogin(uid);
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            profileCache.delete(uid);
          }
          loadProfileAndRoles(uid);
        } else {
          setProfile(null);
          setRoles([]);
        }
      }
    );

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  // EMERGENCY MODE: removed live user_roles subscription. Roles refresh on
  // next sign-in / token-refresh / page reload, which is enough while the
  // database is recovering from saturation.

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isReady, profile, roles, isSuperAdmin: roles.includes('super_admin'), signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
