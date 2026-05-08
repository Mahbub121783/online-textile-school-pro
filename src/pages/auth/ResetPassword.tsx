import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import OTSLogo from '@/assets/OTS_LOGO.png';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [hasSupabaseSession, setHasSupabaseSession] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Backwards-compat: if user arrived via legacy Supabase recovery link with #access_token,
    // Supabase auto-creates a session — we'll use updateUser() in that case.
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get('type') === 'recovery' || hashParams.get('access_token')) {
      setHasSupabaseSession(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (password.length < 6) {
      setServerError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setServerError('Passwords do not match');
      return;
    }

    setLoading(true);

    if (token) {
      const { data, error } = await supabase.functions.invoke('password-reset-verify', {
        body: { token, new_password: password },
      });
      setLoading(false);
      const result: any = data || {};
      if (error || result?.error) {
        setServerError(result?.message || error?.message || 'Could not reset password');
        return;
      }
      toast({ title: 'Password updated!', description: 'You can now sign in with your new password.' });
      navigate('/auth/login');
      return;
    }

    if (hasSupabaseSession) {
      const { error } = await supabase.auth.updateUser({ password });
      setLoading(false);
      if (error) {
        setServerError(error.message);
        return;
      }
      toast({ title: 'Password updated!', description: 'You can now sign in with your new password.' });
      navigate('/auth/login');
      return;
    }

    setLoading(false);
    setServerError('This reset link is invalid or expired. Please request a new one.');
  };

  const linkInvalid = !token && !hasSupabaseSession;

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border rounded-xl shadow-lg p-8">
        <div className="text-center mb-6">
          <Link to="/"><img src={OTSLogo} alt="OTS" className="h-14 w-14 mx-auto mb-3 object-contain" /></Link>
          <h1 className="font-heading text-2xl font-bold text-foreground">Set New Password</h1>
          {emailParam && (
            <p className="text-sm text-muted-foreground mt-1">For <span className="font-medium text-foreground">{emailParam}</span></p>
          )}
        </div>

        {linkInvalid ? (
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex gap-2">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <span>This reset link is invalid or has expired. Please request a new password reset.</span>
            </div>
            <Link to="/auth/forgot-password">
              <Button className="w-full bg-primary text-primary-foreground h-11">Request New Reset Link</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {serverError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex gap-2">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <Button type="submit" className="w-full bg-primary text-primary-foreground h-11" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        )}

        <div className="text-center mt-6">
          <Link to="/auth/login" className="text-sm text-primary hover:underline flex items-center justify-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
