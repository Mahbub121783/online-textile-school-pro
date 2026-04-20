import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, AtSign, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import OTSLogo from '@/assets/OTS_LOGO.png';

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '', username: '', email: '', password: '', confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || '';

  const update = (field: string, value: string) => {
    if (field === 'username') value = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Live username availability check (debounced)
  useEffect(() => {
    const u = formData.username.trim();
    if (!u) { setUsernameStatus('idle'); return; }
    if (!USERNAME_REGEX.test(u)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', u)
        .maybeSingle();
      if (error) { setUsernameStatus('idle'); return; }
      setUsernameStatus(data ? 'taken' : 'available');
    }, 400);
    return () => clearTimeout(t);
  }, [formData.username]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (formData.password.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    if (!USERNAME_REGEX.test(formData.username)) {
      toast({ title: 'Invalid username', description: '3–30 characters, lowercase letters, numbers, underscores only.', variant: 'destructive' });
      return;
    }
    if (usernameStatus === 'taken') {
      toast({ title: 'Username taken', description: 'Please choose a different username.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: formData.fullName,
          username: formData.username,
          ...(refCode ? { ref: refCode } : {}),
        },
      },
    });
    if (error) {
      toast({ title: 'Registration failed', description: error.message, variant: 'destructive' });
    } else {
      try {
        await supabase.functions.invoke('send-smtp-email', {
          body: {
            templateKey: 'user_registration',
            recipientEmail: formData.email,
            placeholders: {
              user_name: formData.fullName || 'Student',
              site_name: 'Online Textile School',
              login_url: `${window.location.origin}/auth/login`,
              user_roll_id: '(pending)',
            },
          },
        });
      } catch { /* non-critical */ }
      toast({ title: 'Registration successful!', description: 'Please check your email to verify your account.' });
      navigate('/auth/login');
    }
    setLoading(false);
  };

  const usernameHelper = () => {
    switch (usernameStatus) {
      case 'checking': return <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Checking…</span>;
      case 'available': return <span className="text-xs text-green-600 flex items-center gap-1"><Check className="h-3 w-3" /> Available</span>;
      case 'taken': return <span className="text-xs text-destructive flex items-center gap-1"><X className="h-3 w-3" /> Already taken</span>;
      case 'invalid': return <span className="text-xs text-destructive">3–30 chars: lowercase, numbers, underscores only</span>;
      default: return <span className="text-xs text-muted-foreground">Lowercase letters, numbers, underscores</span>;
    }
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md bg-card border rounded-xl shadow-lg p-8">
        <div className="text-center mb-6">
          <Link to="/"><img src={OTSLogo} alt="OTS" className="h-14 w-14 mx-auto mb-3 object-contain" /></Link>
          <h1 className="font-heading text-2xl font-bold text-foreground">Create Your Account</h1>
          <p className="text-sm text-muted-foreground mt-1">Join the largest textile learning community</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Your full name" value={formData.fullName} onChange={(e) => update('fullName', e.target.value)} className="pl-10" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Username *</Label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="your_username" value={formData.username} onChange={(e) => update('username', e.target.value)} className="pl-10" maxLength={30} required />
            </div>
            {usernameHelper()}
          </div>

          <div className="space-y-2">
            <Label>Email *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="email" placeholder="you@example.com" value={formData.email} onChange={(e) => update('email', e.target.value)} className="pl-10" required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type={showPassword ? 'text' : 'password'} placeholder="Min 6 characters" value={formData.password} onChange={(e) => update('password', e.target.value)} className="pl-10 pr-10" required />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirm Password *</Label>
              <Input type="password" placeholder="Repeat password" value={formData.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} required />
            </div>
          </div>

          <Button type="submit" className="w-full bg-accent hover:bg-accent-hover text-accent-foreground h-11 mt-2" disabled={loading || usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking'}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account? <Link to="/auth/login" className="text-primary font-medium hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
