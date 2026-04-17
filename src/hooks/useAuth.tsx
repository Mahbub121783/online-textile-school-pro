import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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

const fetchUserData = async (userId: string) => {
  const [profileRes, rolesRes] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', userId).single(),
    supabase.from('user_roles').select('role').eq('user_id', userId),
  ]);
  return {
    profile: profileRes.data,
    roles: rolesRes.data?.map((r: any) => r.role) ?? [],
  };
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

    // 1. Primary init — fetch session first, then profile/roles
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id).then(d => {
          if (!mounted) return;
          setProfile(d.profile);
          setRoles(d.roles);
          setLoading(false);
          setIsReady(true);
        }).catch(() => {
          if (mounted) { setLoading(false); setIsReady(true); }
        });
      } else {
        setLoading(false);
        setIsReady(true);
      }
    });

    // 2. Listener — fire-and-forget, NO await to prevent deadlocks
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'INITIAL_SESSION') return; // Already handled by getSession above
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUserData(session.user.id).then(d => {
            if (!mounted) return;
            setProfile(d.profile);
            setRoles(d.roles);
          });
        } else {
          setProfile(null);
          setRoles([]);
        }
      }
    );

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  // 3. Realtime: keep roles in sync when admin changes them — propagates instantly
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`user-roles-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${user.id}` },
        async () => {
          const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
          setRoles(data?.map((r: any) => r.role) ?? []);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

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
