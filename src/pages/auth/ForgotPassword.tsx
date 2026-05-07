import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, Lock, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import OTSLogo from '@/assets/OTS_LOGO.png';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const requestCode = async () => {
    setLoading(true);
    const { error } = await supabase.functions.invoke('password-reset-request', {
      body: { email: email.trim().toLowerCase() },
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Check your email',
      description: `If an account exists for ${email}, a 6-digit code has been sent.`,
    });
    setStep(2);
    setResendIn(60);
  };

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    requestCode();
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast({ title: 'Enter the 6-digit code', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'Use at least 6 characters', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('password-reset-verify', {
      body: { email: email.trim().toLowerCase(), code, new_password: password },
    });
    setLoading(false);
    if (error || (data && (data as any).error)) {
      const msg = (data as any)?.message || error?.message || 'Could not verify code';
      toast({ title: 'Failed', description: msg, variant: 'destructive' });
      return;
    }
    toast({ title: 'Password updated!', description: 'You can now sign in with your new password.' });
    navigate('/auth/login');
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border rounded-xl shadow-lg p-8">
        <div className="text-center mb-6">
          <Link to="/"><img src={OTSLogo} alt="OTS" className="h-14 w-14 mx-auto mb-3 object-contain" /></Link>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {step === 1 ? 'Reset Password' : 'Enter Verification Code'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === 1
              ? 'Enter your email and we\'ll send you a 6-digit code'
              : `We sent a 6-digit code to ${email}`}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground h-11" disabled={loading}>
              {loading ? 'Sending...' : 'Send Code'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleStep2} className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> 6-digit Code</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

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

            <Button type="submit" className="w-full bg-primary text-primary-foreground h-11" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </Button>

            <div className="flex items-center justify-between text-sm pt-2">
              <button
                type="button"
                onClick={() => { setStep(1); setCode(''); setPassword(''); setConfirmPassword(''); }}
                className="text-muted-foreground hover:text-foreground"
              >
                Change email
              </button>
              <button
                type="button"
                onClick={requestCode}
                disabled={resendIn > 0 || loading}
                className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
              </button>
            </div>
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

export default ForgotPassword;
