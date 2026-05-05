import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Upload, Clock, Users, Calendar, Camera, Star, FileUp } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';
import SEOHead from '@/components/SEOHead';

interface Purpose {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  max_entries: number | null;
  photo_required: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  custom_fields: any[];
  current_count?: number;
}

interface FormConfig {
  id: string;
  fields_order: string[];
  page_title: string;
  page_subtitle: string | null;
  banner_url: string | null;
  event_details: string | null;
  countdown_target: string | null;
  custom_css: string | null;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const BASE_FIELD_LABELS: Record<string, string> = {
  full_name: 'Full Name',
  email: 'Email Address',
  mobile: 'Mobile Number',
  blood_group: 'Blood Group',
  university: 'University / Institution',
  batch: 'Batch / Year',
};

function useCountdown(target: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
  useEffect(() => {
    if (!target) return;
    const update = () => {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }); return; }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        expired: false,
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [target]);
  return timeLeft;
}

const CountdownUnit = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <div className="bg-primary text-primary-foreground rounded-lg w-16 h-16 flex items-center justify-center text-2xl font-bold font-heading shadow-lg">
      {String(value).padStart(2, '0')}
    </div>
    <span className="text-xs mt-1 text-muted-foreground uppercase tracking-wider">{label}</span>
  </div>
);

export default function PublicRegistration() {
  const { slug } = useParams<{ slug?: string }>();
  const { toast } = useToast();
  const { upload, uploading } = useFileUpload();

  const [config, setConfig] = useState<FormConfig | null>(null);
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [universities, setUniversities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [regId, setRegId] = useState('');

  const [selectedPurpose, setSelectedPurpose] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, string>>({
    full_name: '', email: '', mobile: '', blood_group: '', university: '', batch: '',
    business_name: '', job_area: '', experience_years: '', photo_url: '',
  });
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const [uniQuery, setUniQuery] = useState('');
  const [showUniSuggestions, setShowUniSuggestions] = useState(false);

  const countdown = useCountdown(config?.countdown_target ?? null);
  const activePurpose = useMemo(() => purposes.find(p => p.id === selectedPurpose), [purposes, selectedPurpose]);

  useEffect(() => {
    const load = async () => {
      const [cfgRes, purpRes, uniRes] = await Promise.all([
        supabase.from('registration_form_config' as any).select('*').limit(1).single(),
        supabase.from('registration_purposes' as any).select('*').eq('is_active', true).order('sort_order'),
        supabase.from('registrations' as any).select('university'),
      ]);
      if (cfgRes.data) setConfig(cfgRes.data as any);

      // Get counts per purpose
      const purposeData = (purpRes.data || []) as any[];
      const countRes = await supabase.from('registrations' as any).select('purpose_id');
      const counts: Record<string, number> = {};
      ((countRes.data || []) as any[]).forEach((r: any) => {
        counts[r.purpose_id] = (counts[r.purpose_id] || 0) + 1;
      });

      const now = new Date();
      const filtered = purposeData.filter((p: any) => {
        if (p.starts_at && new Date(p.starts_at) > now) return false;
        if (p.ends_at && new Date(p.ends_at) < now) return false;
        if (p.max_entries && (counts[p.id] || 0) >= p.max_entries) return false;
        return true;
      }).map((p: any) => ({ ...p, current_count: counts[p.id] || 0 }));

      setPurposes(filtered);
      if (slug) {
        const match = filtered.find((p: any) => p.slug === slug);
        if (match) setSelectedPurpose(match.id);
      }

      const unis = [...new Set(((uniRes.data || []) as any[]).map((r: any) => r.university).filter(Boolean))];
      setUniversities(unis as string[]);
      setLoading(false);
    };
    load();
  }, [slug]);

  const filteredUnis = useMemo(() =>
    uniQuery.length > 0 ? universities.filter(u => u.toLowerCase().includes(uniQuery.toLowerCase())).slice(0, 8) : [],
    [uniQuery, universities]
  );

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await upload(file);
    if (result?.url) setFormData(prev => ({ ...prev, photo_url: result.url }));
  }, [upload]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurpose) { toast({ title: 'Please select a registration purpose', variant: 'destructive' }); return; }
    if (!formData.full_name || !formData.email || !formData.mobile) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' }); return;
    }
    if (activePurpose?.photo_required && !formData.photo_url) {
      toast({ title: 'Photo is required for this registration', variant: 'destructive' }); return;
    }
    // Validate custom required fields
    const cfs = (activePurpose?.custom_fields || []) as any[];
    for (const cf of cfs) {
      if (!cf.required) continue;
      const v = extraFields[cf.key];
      const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
      if (empty) {
        toast({ title: `${cf.label} is required`, variant: 'destructive' });
        return;
      }
    }

    setSubmitting(true);
    const { data, error } = await supabase.from('registrations' as any).insert({
      purpose_id: selectedPurpose,
      full_name: formData.full_name,
      email: formData.email,
      mobile: formData.mobile,
      blood_group: formData.blood_group || null,
      university: formData.university || null,
      batch: formData.batch || null,
      business_name: formData.business_name || null,
      job_area: formData.job_area || null,
      experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
      photo_url: formData.photo_url || null,
      extra_fields: Object.keys(extraFields).length > 0 ? extraFields : {},
    } as any).select('id').single();

    setSubmitting(false);
    if (error) { toast({ title: 'Registration failed', description: error.message, variant: 'destructive' }); return; }
    setRegId((data as any)?.id?.slice(0, 8).toUpperCase() || 'OK');
    setSubmitted(true);
    toast({ title: 'Registration successful!' });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Loading registration form...</div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <Card className="max-w-md w-full text-center animate-in zoom-in duration-500">
        <CardContent className="pt-8 pb-8 space-y-4">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-heading font-bold">Registration Complete!</h2>
          <p className="text-muted-foreground">Your registration has been submitted successfully.</p>
          <Badge variant="outline" className="text-lg px-4 py-2 font-mono">REG-{regId}</Badge>
          <p className="text-sm text-muted-foreground">Save this registration number for your records.</p>
        </CardContent>
      </Card>
    </div>
  );

  const purposeSlug = activePurpose?.slug?.toLowerCase() || '';
  const showBusiness = purposeSlug === 'business';
  const showJob = purposeSlug === 'job';
  const customFields = (activePurpose?.custom_fields || []) as any[];

  return (
    <>
      <SEOHead title={config?.page_title || 'Register'} description={config?.page_subtitle || 'Registration form'} />
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/5 to-background">
        {/* Banner */}
        {config?.banner_url && (
          <div className="w-full h-48 md:h-64 relative overflow-hidden">
            <img src={config.banner_url} alt="Banner" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          </div>
        )}

        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground">{config?.page_title || 'Register'}</h1>
            {config?.page_subtitle && <p className="text-muted-foreground text-lg">{config.page_subtitle}</p>}
          </div>

          {/* Countdown */}
          {config?.countdown_target && !countdown.expired && (
            <div className="flex justify-center gap-3">
              <CountdownUnit value={countdown.days} label="Days" />
              <CountdownUnit value={countdown.hours} label="Hours" />
              <CountdownUnit value={countdown.minutes} label="Min" />
              <CountdownUnit value={countdown.seconds} label="Sec" />
            </div>
          )}

          {/* Event Details */}
          {config?.event_details && (
            <Card>
              <CardContent className="pt-4">
                <div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: config.event_details }} />
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          {purposes.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {purposes.map(p => (
                <Badge key={p.id} variant="secondary" className="gap-1.5 py-1 px-3">
                  <Users className="w-3 h-3" />
                  {p.name}: {p.current_count || 0}{p.max_entries ? `/${p.max_entries}` : ''}
                </Badge>
              ))}
            </div>
          )}

          {/* Form */}
          <Card className="shadow-lg border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Registration Form
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Purpose Selection */}
                <div className="space-y-2">
                  <Label className="font-semibold">Registration Purpose *</Label>
                  <Select value={selectedPurpose} onValueChange={setSelectedPurpose}>
                    <SelectTrigger><SelectValue placeholder="Select purpose..." /></SelectTrigger>
                    <SelectContent>
                      {purposes.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.max_entries && <span className="text-muted-foreground ml-2">({p.current_count || 0}/{p.max_entries} spots)</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Base Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Full Name *</Label>
                    <Input value={formData.full_name} onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))} placeholder="Enter your full name" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Mobile *</Label>
                    <Input value={formData.mobile} onChange={e => setFormData(p => ({ ...p, mobile: e.target.value }))} placeholder="+880..." required />
                  </div>
                  <div className="space-y-2">
                    <Label>Blood Group</Label>
                    <Select value={formData.blood_group} onValueChange={v => setFormData(p => ({ ...p, blood_group: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {BLOOD_GROUPS.map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 relative">
                    <Label>University / Institution</Label>
                    <Input
                      value={formData.university}
                      onChange={e => { setFormData(p => ({ ...p, university: e.target.value })); setUniQuery(e.target.value); setShowUniSuggestions(true); }}
                      onBlur={() => setTimeout(() => setShowUniSuggestions(false), 200)}
                      placeholder="Start typing..."
                    />
                    {showUniSuggestions && filteredUnis.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 bg-popover border rounded-md shadow-lg mt-1 max-h-40 overflow-auto">
                        {filteredUnis.map(u => (
                          <button key={u} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                            onClick={() => { setFormData(p => ({ ...p, university: u })); setShowUniSuggestions(false); }}>
                            {u}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Batch / Year</Label>
                    <Input value={formData.batch} onChange={e => setFormData(p => ({ ...p, batch: e.target.value }))} placeholder="e.g. 2024" />
                  </div>
                </div>

                {/* Conditional Fields */}
                {showBusiness && (
                  <div className="space-y-2 animate-in slide-in-from-top duration-300">
                    <Label>Business Name *</Label>
                    <Input value={formData.business_name} onChange={e => setFormData(p => ({ ...p, business_name: e.target.value }))} placeholder="Your business name" required />
                  </div>
                )}
                {showJob && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top duration-300">
                    <div className="space-y-2">
                      <Label>Current Job Area *</Label>
                      <Input value={formData.job_area} onChange={e => setFormData(p => ({ ...p, job_area: e.target.value }))} placeholder="e.g. Marketing" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Years of Experience</Label>
                      <Input type="number" min="0" value={formData.experience_years} onChange={e => setFormData(p => ({ ...p, experience_years: e.target.value }))} placeholder="0" />
                    </div>
                  </div>
                )}

                {/* Custom Fields */}
                {customFields.length > 0 && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Additional Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {customFields.map((cf: any) => (
                        <CustomFieldRenderer
                          key={cf.key}
                          field={cf}
                          value={extraFields[cf.key]}
                          onChange={(v) => setExtraFields(p => ({ ...p, [cf.key]: v }))}
                          uploader={upload}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Photo Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Camera className="w-4 h-4" />
                    Photo {activePurpose?.photo_required ? '*' : '(Optional)'}
                  </Label>
                  {formData.photo_url ? (
                    <div className="flex items-center gap-3">
                      <img src={formData.photo_url} alt="Uploaded" className="w-20 h-20 rounded-lg object-cover border" />
                      <Button type="button" variant="outline" size="sm" onClick={() => setFormData(p => ({ ...p, photo_url: '' }))}>Remove</Button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{uploading ? 'Uploading...' : 'Click to upload photo'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                    </label>
                  )}
                </div>

                <Button type="submit" className="w-full h-12 text-lg font-heading font-semibold" disabled={submitting || uploading}>
                  {submitting ? 'Submitting...' : 'Submit Registration'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
