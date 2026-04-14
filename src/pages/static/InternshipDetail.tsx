import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Briefcase, Clock, DollarSign, MapPin, Users, Calendar, ArrowLeft, Send, Eye, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFileUpload } from '@/hooks/useFileUpload';

const InternshipDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ cover_letter: '', resume_url: '', portfolio_url: '', skills: '' as string, availability_date: '' });
  const { upload, uploading } = useFileUpload();

  const { data: internship, isLoading } = useQuery({
    queryKey: ['internship-detail', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('internships')
        .select('*, supervisor:user_profiles!internships_supervisor_id_fkey(full_name, avatar_url)')
        .eq('id', id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  // Track view
  useEffect(() => {
    if (id) supabase.rpc('increment_internship_view', { _internship_id: id });
  }, [id]);

  const { data: myApp } = useQuery({
    queryKey: ['my-app-for-internship', id, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('internship_applications')
        .select('*')
        .eq('internship_id', id!)
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!id,
  });

  const { data: related = [] } = useQuery({
    queryKey: ['related-internships', internship?.department],
    queryFn: async () => {
      if (!internship?.department) return [];
      const { data } = await supabase
        .from('internships')
        .select('id, title, company, location, internship_type')
        .eq('is_published', true)
        .eq('department', internship.department)
        .neq('id', id!)
        .limit(4);
      return data ?? [];
    },
    enabled: !!internship?.department,
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('internship_applications').insert({
        internship_id: id!,
        user_id: user!.id,
        cover_letter: form.cover_letter || null,
        resume_url: form.resume_url || null,
        portfolio_url: form.portfolio_url || null,
        skills: form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : null,
        availability_date: form.availability_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-app-for-internship'] });
      setApplyOpen(false);
      setStep(1);
      toast.success('Application submitted successfully!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await upload(file, { forceR2: true });
    const url = result?.url;
    if (url) setForm(p => ({ ...p, resume_url: url }));
  };

  if (isLoading) return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 flex items-center justify-center"><p className="animate-pulse text-muted-foreground">Loading...</p></div>
      <Footer />
    </div>
  );

  if (!internship) return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 flex items-center justify-center flex-col gap-3">
        <Briefcase className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Internship not found</p>
        <Button variant="outline" asChild><Link to="/internships"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link></Button>
      </div>
      <Footer />
    </div>
  );

  const posLeft = internship.positions_available - (internship.positions_filled || 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/internships"><ArrowLeft className="h-4 w-4 mr-1" /> All Internships</Link>
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="font-heading text-2xl font-bold">{internship.title}</h1>
                      {internship.is_featured && <Badge variant="secondary">Featured</Badge>}
                    </div>
                    <p className="text-muted-foreground flex items-center gap-1 mt-1">
                      <Building2 className="h-4 w-4" /> {internship.company}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize text-sm">{internship.internship_type}</Badge>
                </div>

                <div className="flex flex-wrap gap-4 mt-4 text-sm">
                  {internship.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-muted-foreground" />{internship.location}</span>}
                  {internship.stipend && <span className="flex items-center gap-1"><DollarSign className="h-4 w-4 text-muted-foreground" />{internship.stipend}</span>}
                  {internship.duration && <span className="flex items-center gap-1"><Clock className="h-4 w-4 text-muted-foreground" />{internship.duration}</span>}
                  {posLeft > 0 && <span className="flex items-center gap-1"><Users className="h-4 w-4 text-muted-foreground" />{posLeft} positions</span>}
                  {internship.view_count > 0 && <span className="flex items-center gap-1"><Eye className="h-4 w-4 text-muted-foreground" />{internship.view_count} views</span>}
                </div>

                {internship.application_deadline && (
                  <p className="text-sm mt-3 flex items-center gap-1 text-orange-600 dark:text-orange-400">
                    <Calendar className="h-4 w-4" /> Deadline: {new Date(internship.application_deadline).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>

            {internship.description && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Description</CardTitle></CardHeader>
                <CardContent><div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line">{internship.description}</div></CardContent>
              </Card>
            )}

            {internship.requirements && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Requirements</CardTitle></CardHeader>
                <CardContent><div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line">{internship.requirements}</div></CardContent>
              </Card>
            )}

            {internship.skills_required?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Skills Required</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {internship.skills_required.map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-5">
                {myApp ? (
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">You've applied</p>
                    <Badge className="capitalize text-sm">{myApp.status}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Applied on {new Date(myApp.created_at).toLocaleDateString()}</p>
                  </div>
                ) : user ? (
                  <Button className="w-full gap-2" onClick={() => setApplyOpen(true)}>
                    <Send className="h-4 w-4" /> Apply Now
                  </Button>
                ) : (
                  <Button className="w-full" asChild>
                    <Link to="/auth/login">Login to Apply</Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            {(internship as any).supervisor && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Supervisor</CardTitle></CardHeader>
                <CardContent className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                    {(internship as any).supervisor.full_name?.[0]?.toUpperCase() || 'S'}
                  </div>
                  <p className="font-medium text-sm">{(internship as any).supervisor.full_name}</p>
                </CardContent>
              </Card>
            )}

            {internship.department && (
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="font-medium">{internship.department}</p>
                </CardContent>
              </Card>
            )}

            {related.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Related Internships</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {related.map((r: any) => (
                    <Link key={r.id} to={`/internships/${r.id}`} className="block p-2 rounded hover:bg-muted text-sm">
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.company}</p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />

      {/* Multi-step Apply Dialog */}
      <Dialog open={applyOpen} onOpenChange={o => { setApplyOpen(o); if (!o) setStep(1); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply — {internship.title}</DialogTitle>
            <p className="text-xs text-muted-foreground">Step {step} of 3</p>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-4">
              <div><Label>Your Skills (comma-separated)</Label><Input value={form.skills} onChange={e => setForm(p => ({ ...p, skills: e.target.value }))} placeholder="React, Python, Data Analysis" /></div>
              <div><Label>Availability Date</Label><Input type="date" value={form.availability_date} onChange={e => setForm(p => ({ ...p, availability_date: e.target.value }))} /></div>
              <div><Label>Portfolio URL (optional)</Label><Input value={form.portfolio_url} onChange={e => setForm(p => ({ ...p, portfolio_url: e.target.value }))} placeholder="https://..." /></div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Upload Resume (PDF)</Label>
                <Input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} disabled={uploading} />
                {form.resume_url && <p className="text-xs text-green-600 mt-1">✓ Resume uploaded</p>}
                {uploading && <p className="text-xs text-muted-foreground mt-1 animate-pulse">Uploading...</p>}
              </div>
              <div><Label>Or paste Resume URL</Label><Input value={form.resume_url} onChange={e => setForm(p => ({ ...p, resume_url: e.target.value }))} placeholder="https://drive.google.com/..." /></div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div><Label>Cover Letter</Label><Textarea value={form.cover_letter} onChange={e => setForm(p => ({ ...p, cover_letter: e.target.value }))} rows={6} placeholder="Why are you interested in this internship..." /></div>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <div>
              {step > 1 && <Button variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancel</Button>
              {step < 3 ? (
                <Button onClick={() => setStep(s => s + 1)}>Next</Button>
              ) : (
                <Button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
                  {applyMutation.isPending ? 'Submitting...' : 'Submit Application'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InternshipDetail;
