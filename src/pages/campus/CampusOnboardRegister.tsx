import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { CheckCircle, Loader2 } from 'lucide-react';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const CampusOnboardRegister = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    campusName: '', area: '', facilities: '', studentCount: '',
    contactName: profile?.full_name || '', contactEmail: user?.email || '', contactPhone: profile?.phone || '',
    description: '',
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.campusName.trim() || !form.area.trim() || !form.contactName.trim() || !form.contactEmail.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const slugBase = slugify(form.campusName);
      const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await supabase.from('campus_onboard_requests').insert({
        campus_name: form.campusName,
        area: form.area,
        facilities: form.facilities || null,
        student_count: form.studentCount ? parseInt(form.studentCount, 10) : null,
        contact_name: form.contactName,
        contact_email: form.contactEmail,
        contact_phone: form.contactPhone || null,
        description: form.description || null,
        subdomain_slug: slug,
        submitted_by: user?.id || null,
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success('Campus onboarding request submitted!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit request');
    }
    setSubmitting(false);
  };

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Campus Name *</Label>
                <Input value={form.campusName} onChange={(e) => update('campusName', e.target.value)} required />
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
