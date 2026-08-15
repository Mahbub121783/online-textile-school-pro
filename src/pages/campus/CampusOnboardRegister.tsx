import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { CheckCircle, Loader2, ImagePlus, X, Clock, XCircle } from 'lucide-react';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const CampusOnboardRegister = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Logo upload (and, previously, submission) go through auth-gated backend
  // endpoints -- an anonymous visitor could reach this form and get an
  // unexplained "Unauthorized" the moment they tried to upload a logo.
  // Require sign-in up front instead, matching EbookReader.tsx's pattern.
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/login?redirect=/campus-onboard/register');
    }
  }, [authLoading, user, navigate]);

  // Nothing previously stopped a signed-in user from submitting the same
  // campus twice, or told them their request was already pending/rejected --
  // they'd just see the blank form again every time they came back. Check
  // for an existing request of theirs first and short-circuit to a status
  // view instead.
  const { data: existingRequest, isLoading: existingLoading } = useQuery({
    queryKey: ['my-campus-request', user?.id],
    enabled: !!user,
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campus_onboard_requests')
        .select('id, campus_name, status, rejection_reason, subdomain_slug')
        .eq('submitted_by', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existingRequest?.status === 'approved') {
      navigate('/dashboard/campus');
    }
  }, [existingRequest, navigate]);

  const { upload: uploadFile, uploading: logoUploading } = useFileUpload();
  const { upload: uploadCoverFile, uploading: coverUploading } = useFileUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState({
    campusName: '', area: '', facilities: '', studentCount: '', departments: '',
    contactName: profile?.full_name || '', contactEmail: user?.email || '', contactPhone: profile?.phone || '',
    description: '', subdomainSlug: '',
  });

  // Auto-suggest a subdomain slug from the campus name, but only until the
  // registrant actually edits the slug field themselves.
  useEffect(() => {
    if (slugTouched) return;
    setForm((p) => ({ ...p, subdomainSlug: slugify(p.campusName) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.campusName, slugTouched]);

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadFile(file, { folder: 'campus-logos' });
      setLogoUrl(result.url);
      toast.success('Logo uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Logo upload failed');
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadCoverFile(file, { folder: 'campus-covers' });
      setCoverUrl(result.url);
      toast.success('Cover photo uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Cover photo upload failed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.campusName.trim() || !form.area.trim() || !form.contactName.trim() || !form.contactEmail.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    const slug = slugify(form.subdomainSlug || form.campusName);
    if (!slug) {
      toast.error('Please provide a valid subdomain name');
      return;
    }
    setSubmitting(true);
    try {
      const departments = form.departments
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
      const { error } = await supabase.from('campus_onboard_requests').insert({
        campus_name: form.campusName,
        area: form.area,
        facilities: form.facilities || null,
        student_count: form.studentCount ? parseInt(form.studentCount, 10) : null,
        departments,
        logo_url: logoUrl,
        cover_image_url: coverUrl,
        contact_name: form.contactName,
        contact_email: form.contactEmail,
        contact_phone: form.contactPhone || null,
        description: form.description || null,
        subdomain_slug: slug,
        submitted_by: user?.id || null,
      });
      if (error) {
        if (String(error.message).toLowerCase().includes('unique')) {
          throw new Error('That subdomain name is already taken. Please choose another.');
        }
        throw error;
      }
      setSubmitted(true);
      setResubmitting(false);
      queryClient.invalidateQueries({ queryKey: ['my-campus-request', user?.id] });
      toast.success('Campus onboarding request submitted!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit request');
    }
    setSubmitting(false);
  };

  if (authLoading || !user || existingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col">
        <UtilityBar /><Header />
        <main className="flex-1 flex items-center justify-center py-16">
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-heading font-bold">Request Submitted!</h2>
              <p className="text-muted-foreground text-sm">
                Your campus onboarding request has been received. Our admin team will review it and get back to you.
              </p>
              <Button onClick={() => navigate('/campus-onboard')}>View Campus Network</Button>
            </CardContent>
          </Card>
        </main>
        <Footer /><BottomNav />
      </div>
    );
  }

  if (existingRequest && existingRequest.status !== 'approved' && !resubmitting) {
    const isPending = existingRequest.status === 'pending';
    return (
      <div className="min-h-screen flex flex-col">
        <UtilityBar /><Header />
        <main className="flex-1 flex items-center justify-center py-16">
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${isPending ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                {isPending ? <Clock className="w-8 h-8 text-yellow-600" /> : <XCircle className="w-8 h-8 text-red-600" />}
              </div>
              <h2 className="text-xl font-heading font-bold">
                {isPending ? 'Your Request Is Under Review' : 'Request Not Approved'}
              </h2>
              <p className="text-muted-foreground text-sm">
                {isPending
                  ? `"${existingRequest.campus_name}" is pending admin review. You'll get a notification the moment it's decided.`
                  : `"${existingRequest.campus_name}" wasn't approved.${existingRequest.rejection_reason ? ` Reason: ${existingRequest.rejection_reason}` : ''}`}
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => navigate('/campus-onboard')}>View Campus Network</Button>
                {!isPending && <Button onClick={() => setResubmitting(true)}>Submit a New Request</Button>}
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer /><BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <UtilityBar /><Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="bg-secondary py-6">
          <div className="container"><h1 className="font-heading text-2xl font-bold">Onboard Your Campus</h1>
            <p className="text-muted-foreground mt-1 text-sm">Bring your institution into the Online Textile School network.</p>
          </div>
        </div>
        <div className="container py-8 max-w-2xl">
          <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-6 space-y-5">
            <div className="space-y-2">
              <Label>Campus Logo</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/30 shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Campus logo" className="w-full h-full object-cover" />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={logoUploading}>
                    {logoUploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5 mr-1.5" />}
                    {logoUrl ? 'Change Logo' : 'Upload Logo'}
                  </Button>
                  {logoUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cover Photo</Label>
              <div className="w-full h-32 rounded-xl border-2 border-dashed overflow-hidden bg-muted/30 flex items-center justify-center relative">
                {coverUrl ? (
                  <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground text-xs gap-1">
                    <ImagePlus className="h-5 w-5" /> Wide banner shown at the top of your public portfolio
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <input id="cover-upload-input" type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('cover-upload-input')?.click()} disabled={coverUploading}>
                  {coverUploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5 mr-1.5" />}
                  {coverUrl ? 'Change Cover' : 'Upload Cover Photo'}
                </Button>
                {coverUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCoverUrl(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Campus Name *</Label>
                <Input value={form.campusName} onChange={(e) => update('campusName', e.target.value)} required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Subdomain Name *</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    value={form.subdomainSlug}
                    onChange={(e) => { setSlugTouched(true); update('subdomainSlug', slugify(e.target.value)); }}
                    placeholder="your-campus-name"
                    required
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.onlinetextileschool.com</span>
                </div>
                <p className="text-xs text-muted-foreground">Auto-suggested from the campus name — edit if you'd like a different one.</p>
              </div>
              <div className="space-y-2">
                <Label>Area / Location *</Label>
                <Input value={form.area} onChange={(e) => update('area', e.target.value)} placeholder="e.g. Gazipur, Dhaka" required />
              </div>
              <div className="space-y-2">
                <Label>Approx. Student Count</Label>
                <Input type="number" min="0" value={form.studentCount} onChange={(e) => update('studentCount', e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Departments</Label>
                <Input value={form.departments} onChange={(e) => update('departments', e.target.value)} placeholder="Textile Engineering, Fashion Design, Wet Processing (comma-separated)" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Facilities</Label>
                <Textarea value={form.facilities} onChange={(e) => update('facilities', e.target.value)} placeholder="Labs, library, hostel, workshop equipment..." rows={3} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Additional Details</Label>
                <Textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Contact Name *</Label>
                <Input value={form.contactName} onChange={(e) => update('contactName', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Contact Email *</Label>
                <Input type="email" value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 bg-accent hover:bg-accent-hover text-accent-foreground" disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : 'Submit for Review'}
            </Button>
          </form>
        </div>
      </main>
      <Footer /><BottomNav />
    </div>
  );
};

export default CampusOnboardRegister;
