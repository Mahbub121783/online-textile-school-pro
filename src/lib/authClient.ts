// Drop-in replacement for supabase-js's `.auth` module, backed by our
// self-hosted /auth/v1/* endpoints (see backend/src/auth.js). Not wire
// compatible with GoTrue -- this is a custom JWT client. Kept API-shape
// compatible with the handful of supabase.auth.* methods actually used
// across the app (getSession, getUser, onAuthStateChange, signInWithPassword,
// signUp, signOut, updateUser) so those call sites don't need to change.
//
// signInWithOAuth (Google) is a full-page redirect to the backend's own
// OAuth flow (backend/src/functions/googleOAuth.js), not a popup -- it
// returns control to the browser via navigation, then exchangeOAuthCode()
// below completes it once the backend redirects back to /auth/callback.

const STORAGE_KEY = 'ots-auth-session';
const API_BASE = import.meta.env.VITE_SUPABASE_URL;

// Sessions are issued with a short JWT_EXPIRE (see backend/.env) so an idle
// account auto-logs-out instead of staying valid for weeks. refreshSession()
// (called from useAuth.tsx while the app is open/focused) renews it -- this
// just throttles those calls so an open tab doesn't re-sign a token every 30s.
const REFRESH_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastRefreshAttempt = 0;

type StoredSession = {
  access_token: string;
  token_type: string;
  user: { id: string; email: string; created_at: string };
};

type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED' | 'INITIAL_SESSION';
type Listener = (event: AuthEvent, session: StoredSession | null) => void;

const listeners = new Set<Listener>();

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session: StoredSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* quota / private mode -- ignore */ }
}

function emit(event: AuthEvent, session: StoredSession | null) {
  listeners.forEach((l) => l(event, session));
}

// Cross-tab sync: another tab signing in/out updates localStorage, which
// fires a `storage` event in THIS tab (but not the tab that made the change).
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  const session = readSession();
  emit(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
});

async function apiFetch(path: string, options: RequestInit = {}) {
  const session = readSession();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { data: null, error: { message: body.error || res.statusText } };
  return { data: body, error: null };
}

export const authClient = {
  async getSession() {
    return { data: { session: readSession() }, error: null };
  },

  async getUser() {
    const session = readSession();
    return { data: { user: session?.user ?? null }, error: null };
  },

  onAuthStateChange(callback: Listener) {
    listeners.add(callback);
    // Fire INITIAL_SESSION once, matching supabase-js behavior.
    queueMicrotask(() => callback('INITIAL_SESSION', readSession()));
    return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const { data, error } = await apiFetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (error) return { data: { session: null, user: null }, error };
    const session: StoredSession = { access_token: data.access_token, token_type: data.token_type, user: data.user };
    writeSession(session);
    emit('SIGNED_IN', session);
    return { data: { session, user: session.user }, error: null };
  },

  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
    const { data, error } = await apiFetch('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, data: options?.data }),
    });
    if (error) return { data: { session: null, user: null }, error };
    const session: StoredSession = { access_token: data.access_token, token_type: data.token_type, user: data.user };
    writeSession(session);
    emit('SIGNED_IN', session);
    return { data: { session, user: session.user }, error: null };
  },

  async signOut() {
    apiFetch('/auth/v1/logout', { method: 'POST' }).catch(() => {});
    writeSession(null);
    emit('SIGNED_OUT', null);
    return { error: null };
  },

  async updateUser(attrs: { password?: string }) {
    const { data, error } = await apiFetch('/auth/v1/user', {
      method: 'PATCH',
      body: JSON.stringify(attrs),
    });
    if (error) return { data: { user: null }, error };
    const current = readSession();
    if (current) {
      const updated = { ...current, user: { ...current.user, ...data } };
      writeSession(updated);
      emit('USER_UPDATED', updated);
    }
    return { data: { user: data }, error: null };
  },

  async signInWithOAuth({ provider, options }: { provider: string; options?: { redirectTo?: string } }) {
    if (provider !== 'google') {
      return { data: null, error: { message: `${provider} sign-in is not available yet.` } };
    }
    // The backend redirects the browser straight back to this frontend
    // origin, so only a same-origin path (not a full URL) needs to travel
    // through it.
    let redirectPath = '/';
    try {
      const url = new URL(options?.redirectTo || window.location.origin);
      redirectPath = url.pathname + url.search;
    } catch { /* keep default */ }

    window.location.href = `${API_BASE}/auth/v1/google/start?redirect=${encodeURIComponent(redirectPath)}`;
    return { data: null, error: null };
  },

  // Not part of supabase-js's API -- called once by src/pages/auth/OAuthCallback.tsx
  // after the backend's Google OAuth flow redirects back with a one-time code.
  async exchangeOAuthCode(code: string) {
    const { data, error } = await apiFetch('/auth/v1/google/exchange', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    if (error) return { data: { session: null, user: null }, error };
    const session: StoredSession = { access_token: data.access_token, token_type: data.token_type, user: data.user };
    writeSession(session);
    emit('SIGNED_IN', session);
    return { data: { session, user: session.user }, error: null };
  },

  // Not part of supabase-js's API -- called from useAuth.tsx while a tab is
  // open/focused, to keep an active user's session alive (see backend's
  // POST /auth/v1/refresh). No event emitted: only the token string changes,
  // nothing UI-visible.
  async refreshSession() {
    const now = Date.now();
    if (now - lastRefreshAttempt < REFRESH_MIN_INTERVAL_MS) return { error: null };
    lastRefreshAttempt = now;

    const current = readSession();
    if (!current) return { error: null };

    const { data, error } = await apiFetch('/auth/v1/refresh', { method: 'POST' });
    if (error) return { error };
    writeSession({ ...current, access_token: data.access_token, token_type: data.token_type });
    return { error: null };
  },
};
