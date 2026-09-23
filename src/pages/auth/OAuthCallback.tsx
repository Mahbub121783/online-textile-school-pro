import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Landing point for backend/src/functions/googleOAuth.js's redirect after a
// Google sign-in completes -- trades the one-time ?code for a real session,
// then continues on to wherever the user originally clicked "Continue with Google" from.
const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get('code');
    const redirect = searchParams.get('redirect') || '/';
    const oauthError = searchParams.get('oauth_error');

    if (oauthError) {
      toast({ title: 'Google sign-in failed', description: oauthError.replace(/_/g, ' '), variant: 'destructive' });
      navigate('/auth/login', { replace: true });
      return;
    }
    if (!code) {
      navigate('/auth/login', { replace: true });
      return;
    }

    // @ts-expect-error -- exchangeOAuthCode is our own extension to authClient, not part of supabase-js's typed .auth surface
    supabase.auth.exchangeOAuthCode(code).then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        toast({ title: 'Google sign-in failed', description: error.message, variant: 'destructive' });
        navigate('/auth/login', { replace: true });
      } else {
        toast({ title: 'Welcome back!' });
        navigate(redirect, { replace: true });
      }
    });
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Signing you in…</p>
    </div>
  );
};

export default OAuthCallback;
