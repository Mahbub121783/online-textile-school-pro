import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BD_DISTRICTS, BLOOD_GROUPS } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { Save, Sun, Moon, Monitor, Camera, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import InstitutionalEmailWidget from '@/components/InstitutionalEmailWidget';
import InstallAppCard from '@/components/InstallAppCard';
import { useTheme } from '@/components/ThemeProvider';
import { Progress } from '@/components/ui/progress';
import { useProfileCompleteness } from '@/hooks/useProfileCompleteness';
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload';
import LocationCapture from '@/components/LocationCapture';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'employee', label: 'Employee' },
  { value: 'businessman', label: 'Businessman' },
];

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const { upload: uploadToCloudinary } = useCloudinaryUpload();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    district: '',
    upazila: '',
    campus: '',
    university: '',
    blood_group: '',
    gender: '',
    occupation: '',
    current_job: '',
    date_of_birth: '',
    batch: '',
    professional_role: '',
    company_name: '',
    business_type: '',
    whatsapp_number: '',
    linkedin_url: '',
    facebook_url: '',
    github_url: '',
    website_url: '',
    headline: '',
    bio: '',
    latitude: null as number | null,
    longitude: null as number | null,
    location_updated_at: null as string | null,
  });

  const [uniSuggestions, setUniSuggestions] = useState<string[]>([]);
  const [showUniSuggestions, setShowUniSuggestions] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        district: profile.district || '',
        upazila: profile.upazila || '',
        campus: profile.campus || '',
        university: profile.university || '',
        blood_group: profile.blood_group || '',
        gender: profile.gender || '',
        occupation: profile.occupation || '',
        current_job: profile.current_job || '',
        date_of_birth: profile.date_of_birth || '',
        batch: profile.batch || '',
        professional_role: profile.professional_role || '',
        company_name: profile.company_name || '',
        business_type: profile.business_type || '',
        whatsapp_number: profile.whatsapp_number || '',
        linkedin_url: profile.linkedin_url || '',
        facebook_url: profile.facebook_url || '',
        github_url: profile.github_url || '',
        website_url: profile.website_url || '',
        headline: profile.headline || '',
        bio: profile.bio || '',
        latitude: profile.latitude ?? null,
        longitude: profile.longitude ?? null,
        location_updated_at: profile.location_updated_at || null,
      });
    }
  }, [profile]);

  // Name change cooldown
  const nameLockInfo = useMemo(() => {
    const lastChanged = profile?.name_last_changed_at;
    if (!lastChanged) return { locked: false, nextDate: null as string | null };
    const next = new Date(new Date(lastChanged).getTime() + 30 * 24 * 60 * 60 * 1000);
    if (next.getTime() > Date.now()) {
      return { locked: true, nextDate: next.toLocaleDateString() };
    }
    return { locked: false, nextDate: null };
  }, [profile?.name_last_changed_at]);

  // University suggestions
  useEffect(() => {
    const fetchUnis = async () => {
      const { data } = await supabase
        .from('user_profiles').select('university')
        .not('university', 'is', null).not('university', 'eq', '').limit(500);
      if (data) {
        const unique = [...new Set(data.map((d: any) => d.university).filter(Boolean))] as string[];
        setUniSuggestions(unique.sort());
      }
    };
    fetchUnis();
  }, []);

  const filteredUniSuggestions = useMemo(() => {
    if (!form.university) return uniSuggestions.slice(0, 8);
    return uniSuggestions.filter(u => u.toLowerCase().includes(form.university.toLowerCase())).slice(0, 8);
  }, [form.university, uniSuggestions]);

  const completenessProfile = useMemo(() => ({
    ...profile,
    ...form,
    avatar_url: profile?.avatar_url,
  }), [profile, form]);

  const { percentage, incomplete, isComplete } = useProfileCompleteness(completenessProfile);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'Image must be under 10MB', variant: 'destructive' });
      return;
    }

    setAvatarUploading(true);
    try {
      // Upload to Cloudinary using user ID as public_id (overwrites previous avatar, original quality preserved)
      const result = await uploadToCloudinary(file, {
        publicId: `users/${user.id}/avatar`,
        folder: 'users',
        overwrite: true,
      });

      // Cache-bust by appending timestamp
      const avatarUrl = `${result.url}?v=${Date.now()}`;

      const { error } = await supabase
        .from('user_profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);
      if (error) throw error;

      await supabase.from('media_library').upsert(
        {
          file_url: result.url,
          file_name: file.name,
          file_type: file.type || 'image/jpeg',
          file_size: file.size,
          uploaded_by: user.id,
        },
        { onConflict: 'file_url' }
      );

      toast({ title: 'Avatar updated!' });
      window.location.reload();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleLocation = (data: { latitude: number; longitude: number; district?: string; upazila?: string; country?: string }) => {
    setForm((prev) => ({
      ...prev,
      latitude: data.latitude,
      longitude: data.longitude,
      district: data.district || prev.district,
      upazila: data.upazila || prev.upazila,
      location_updated_at: new Date().toISOString(),
    }));
    toast({ title: 'Don\'t forget to save', description: 'Click Save Changes to persist your location.' });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const updateData: any = { ...form };

    // Skip name update entirely if locked (defense in depth — DB trigger also enforces)
    if (nameLockInfo.locked) {
      updateData.full_name = profile?.full_name;
    }

    if (form.professional_role === 'student') {
      updateData.company_name = null;
      updateData.business_type = null;
    } else if (form.professional_role === 'employee') {
      updateData.business_type = null;
    } else if (form.professional_role === 'businessman') {
      updateData.company_name = null;
    }

    const { error } = await supabase.from('user_profiles').update(updateData).eq('id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated', description: 'Your settings have been saved.' });
    }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="font-heading text-2xl font-bold">Profile Settings</h2>

      {/* Profile Completeness Card */}
      <div className={`border rounded-xl p-5 ${isComplete ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'}`}>
        <div className="flex items-center gap-3 mb-3">
          {isComplete ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          )}
          <div className="flex-1">
            <p className="font-heading font-bold text-sm">
              Profile Completeness: <span className={isComplete ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>{percentage}%</span>
            </p>
            {!isComplete && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Missing: {incomplete.map(f => f.label).join(', ')}
              </p>
            )}
          </div>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>

      <InstallAppCard />

      {/* Avatar */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-heading font-bold mb-4">Profile Picture</h3>
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-heading font-bold text-muted-foreground">
                  {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <label className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
              <Camera className="h-5 w-5 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={avatarUploading} />
            </label>
          </div>
          <div>
            <p className="text-sm font-medium">Upload original-quality photo</p>
            <p className="text-xs text-muted-foreground">Stored as users/{user?.id?.slice(0, 8)}…/avatar on Cloudinary</p>
            {avatarUploading && <p className="text-xs text-primary mt-1">Uploading…</p>}
          </div>
        </div>
      </div>

      {/* Identity */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-heading font-bold mb-4">Identity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Full Name {nameLockInfo.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
            </Label>
            <Input
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
              disabled={nameLockInfo.locked}
            />
            {nameLockInfo.locked && (
              <p className="text-xs text-muted-foreground">Name can be changed once every 30 days. Next change: {nameLockInfo.nextDate}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={profile?.username || ''} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">Username is permanent.</p>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ''} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+880..." />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp Number</Label>
            <div className="flex gap-2">
              <Input
                value={form.whatsapp_number}
                onChange={(e) => update('whatsapp_number', e.target.value)}
                placeholder="+880... (include country code)"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => update('whatsapp_number', form.phone)}
                disabled={!form.phone}
              >
                Same as phone
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <Input type="date" value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Gender</Label>
            <Select value={form.gender} onValueChange={(v) => update('gender', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Blood Group</Label>
            <Select value={form.blood_group} onValueChange={(v) => update('blood_group', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{BLOOD_GROUPS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Address & Location */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-heading font-bold mb-4">Address & Location</h3>
        <div className="mb-4">
          <LocationCapture onLocation={handleLocation} lastUpdated={form.location_updated_at} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>District</Label>
            <Select value={form.district} onValueChange={(v) => update('district', v)}>
              <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
              <SelectContent>{BD_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Upazila</Label>
            <Input value={form.upazila} onChange={(e) => update('upazila', e.target.value)} placeholder="e.g. Savar" />
          </div>
        </div>
      </div>

      {/* Academic & Professional */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-heading font-bold mb-4">Academic & Professional</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 relative">
            <Label>University / Institution</Label>
            <Input
              value={form.university}
              onChange={(e) => { update('university', e.target.value); setShowUniSuggestions(true); }}
              onFocus={() => setShowUniSuggestions(true)}
              onBlur={() => setTimeout(() => setShowUniSuggestions(false), 200)}
              placeholder="e.g. BUTEX"
            />
            {showUniSuggestions && filteredUniSuggestions.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {filteredUniSuggestions.map((uni) => (
                  <button
                    key={uni}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                    onMouseDown={() => { update('university', uni); setShowUniSuggestions(false); }}
                  >{uni}</button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Campus</Label>
            <Input value={form.campus} onChange={(e) => update('campus', e.target.value)} placeholder="e.g. Main Campus, Dhaka" />
          </div>
          <div className="space-y-2">
            <Label>Batch</Label>
            <Input value={form.batch} onChange={(e) => update('batch', e.target.value)} placeholder="e.g. 45th, 2020" />
          </div>
          <div className="space-y-2">
            <Label>Current Role</Label>
            <Select value={form.professional_role} onValueChange={(v) => update('professional_role', v)}>
              <SelectTrigger><SelectValue placeholder="Select your role" /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Designation</Label>
            <Input value={form.occupation} onChange={(e) => update('occupation', e.target.value)} placeholder="e.g. QC Manager" />
          </div>
          <div className="space-y-2">
            <Label>Present Job</Label>
            <Input value={form.current_job} onChange={(e) => update('current_job', e.target.value)} placeholder="e.g. Senior Merchandiser" />
          </div>

          {form.professional_role === 'employee' && (
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={form.company_name} onChange={(e) => update('company_name', e.target.value)} placeholder="e.g. Ha-Meem Group" />
            </div>
          )}
          {form.professional_role === 'businessman' && (
            <div className="space-y-2">
              <Label>Business Type</Label>
              <Input value={form.business_type} onChange={(e) => update('business_type', e.target.value)} placeholder="e.g. Garment Export" />
            </div>
          )}
        </div>
      </div>

      {/* Public Profile */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-heading font-bold mb-4">Public Profile</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Headline</Label>
            <Input value={form.headline} onChange={(e) => update('headline', e.target.value)} placeholder="e.g. Textile Engineer & Educator" />
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <textarea
              value={form.bio}
              onChange={(e) => update('bio', e.target.value)}
              className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Tell the community about yourself…"
            />
          </div>
        </div>
      </div>

      {/* Social Links */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-heading font-bold mb-4">Social Links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>LinkedIn</Label>
            <Input value={form.linkedin_url} onChange={(e) => update('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/…" />
          </div>
          <div className="space-y-2">
            <Label>Facebook</Label>
            <Input value={form.facebook_url} onChange={(e) => update('facebook_url', e.target.value)} placeholder="https://facebook.com/…" />
          </div>
          <div className="space-y-2">
            <Label>GitHub</Label>
            <Input value={form.github_url} onChange={(e) => update('github_url', e.target.value)} placeholder="https://github.com/…" />
          </div>
          <div className="space-y-2">
            <Label>Personal Website</Label>
            <Input value={form.website_url} onChange={(e) => update('website_url', e.target.value)} placeholder="https://yoursite.com" />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-accent hover:bg-accent-hover text-accent-foreground gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {/* Appearance */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-heading font-bold mb-4">Appearance</h3>
        <div className="flex gap-3">
          {([
            { value: 'light' as const, icon: Sun, label: 'Light' },
            { value: 'dark' as const, icon: Moon, label: 'Dark' },
            { value: 'system' as const, icon: Monitor, label: 'System' },
          ]).map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex flex-col items-center gap-2 px-5 py-3 rounded-lg border-2 transition-all ${
                theme === value
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-muted-foreground/30 text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <InstitutionalEmailWidget />

      {/* Account Info */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-heading font-bold mb-2">Account Info</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Roll ID: <span className="font-medium text-foreground">{profile?.roll_id || '—'}</span></p>
          <p>Username: <span className="font-medium text-foreground">{profile?.username || '—'}</span></p>
          <p>Referral Code: <span className="font-medium text-foreground">{profile?.referral_code || '—'}</span></p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
