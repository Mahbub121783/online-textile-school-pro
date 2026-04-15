import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import SEOHead from '@/components/SEOHead';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CountdownTimer } from '@/components/workshop/CountdownTimer';
import { Calendar, Clock, Users, Download, ExternalLink, CheckCircle, Video, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function WorkshopDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ full_name: '', email: '', mobile: '', institution: '' });
  const [registered, setRegistered] = useState(false);
  const [regNumber, setRegNumber] = useState('');

  const { data: workshop, isLoading } = useQuery({
    queryKey: ['workshop', slug],
    queryFn: async () => {
      // Try slug first, then fallback to ID lookup
      let { data, error } = await supabase
        .from('workshops')
        .select('*, instructor:user_profiles!workshops_instructor_id_fkey(id, full_name, avatar_url)')
        .eq('slug', slug!)
        .maybeSingle();
      if (!data) {
        // Fallback: lookup by ID (for workshops with empty slug)
        const res = await supabase
          .from('workshops')
          .select('*, instructor:user_profiles!workshops_instructor_id_fkey(id, full_name, avatar_url)')
          .eq('id', slug!)
          .maybeSingle();
        data = res.data;
        error = res.error;
      }
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['workshop-sessions', workshop?.id],
    queryFn: async () => {
      const { data } = await supabase.from('workshop_sessions').select('*').eq('workshop_id', workshop!.id).order('sort_order');
      return data || [];
    },
    enabled: !!workshop?.id && workshop?.workshop_type === 'multi_day',
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ['workshop-lessons', workshop?.id],
    queryFn: async () => {
      const { data } = await supabase.from('workshop_lessons').select('*').eq('workshop_id', workshop!.id).order('sort_order');
      return data || [];
    },
    enabled: !!workshop?.id,
  });

  const { data: regCount = 0 } = useQuery({
    queryKey: ['workshop-reg-count', workshop?.id],
    queryFn: async () => {
      const { count } = await supabase.from('workshop_registrations').select('*', { count: 'exact', head: true }).eq('workshop_id', workshop!.id).eq('status', 'registered');
      return count || 0;
    },
    enabled: !!workshop?.id,
  });

  const { data: myRegistration } = useQuery({
    queryKey: ['my-workshop-reg', workshop?.id, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('workshop_registrations').select('*').eq('workshop_id', workshop!.id).eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!workshop?.id && !!user,
  });

  // Auto-fill for logged-in users
  const [autoFilled, setAutoFilled] = useState(false);
  if (!autoFilled && profile) {
    setAutoFilled(true);
    setForm({
      full_name: profile.full_name || '',
      email: user?.email || '',
      mobile: (profile as any).mobile || '',
      institution: '',
    });
  }

  const sendConfirmationEmail = async (regData: any, ws: any) => {
    try {
      const emailBody = `
        <h2>Workshop Registration Confirmed!</h2>
        <p>You have been successfully registered for <strong>${ws.title}</strong>.</p>
        <table style="margin:16px 0;border-collapse:collapse;">
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Registration #</td><td>${regData.registration_number}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Date</td><td>${format(new Date(ws.start_date), 'MMMM dd, yyyy')}</td></tr>
          ${ws.start_time ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Time</td><td>${ws.start_time.slice(0, 5)}${ws.end_time ? ' - ' + ws.end_time.slice(0, 5) : ''}</td></tr>` : ''}
          ${ws.meet_link ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Meet Link</td><td><a href="${ws.meet_link}">${ws.meet_link}</a></td></tr>` : ''}
        </table>
        <p>Please join on time. We look forward to seeing you!</p>
      `;

      await supabase.functions.invoke('send-smtp-email', {
        body: {
          to: regData.email,
          subject: `Workshop Registration Confirmed: ${ws.title}`,
          html: emailBody,
        },
      });
    } catch {
      // Email is non-critical, don't block registration
    }
  };

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim() || !form.email.trim()) throw new Error('Name and email are required');
      const payload: any = {
        workshop_id: workshop!.id,
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        mobile: form.mobile.trim() || null,
        institution: form.institution.trim() || null,
      };
      if (user) payload.user_id = user.id;
      const { data, error } = await supabase.from('workshop_registrations').insert(payload).select().single();
      if (error) {
        if (error.code === '23505') throw new Error('You are already registered for this workshop');
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      setRegistered(true);
      setRegNumber(data.registration_number);
      queryClient.invalidateQueries({ queryKey: ['workshop-reg-count'] });
      toast.success('Registration successful!');
      // Send confirmation email
      sendConfirmationEmail(data, workshop);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;
  if (!workshop) return <div className="min-h-screen flex items-center justify-center"><p>Workshop not found</p></div>;

  const startDt = new Date(`${workshop.start_date}T${workshop.start_time || '00:00'}`);
  const isOngoing = workshop.status === 'ongoing';
  const isUpcoming = startDt > new Date();
  const slotsLeft = workshop.max_participants ? workshop.max_participants - regCount : null;
  const isFull = slotsLeft !== null && slotsLeft <= 0;
  const isRegistered = !!myRegistration || registered;
  const materials = (workshop.materials as any[]) || [];
  const whatYouLearn = (workshop.what_you_learn as string[]) || [];
  const instructor = (workshop as any).instructor;

  return (
    <>
      <SEOHead title={workshop.title} description={workshop.short_description || workshop.description?.slice(0, 160)} />
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {workshop.thumbnail_url && (
                <img src={workshop.thumbnail_url} alt={workshop.title} className="w-full rounded-xl h-64 md:h-80 object-cover" />
              )}
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge>{workshop.status}</Badge>
                  <Badge variant="outline">{workshop.workshop_type === 'multi_day' ? 'Multi-Day' : 'One Day'}</Badge>
                  {workshop.is_featured && <Badge className="bg-amber-500">Featured</Badge>}
                </div>
                <h1 className="text-2xl md:text-3xl font-heading font-bold mb-2">{workshop.title}</h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{format(new Date(workshop.start_date), 'MMMM dd, yyyy')}</span>
                  {workshop.end_date && <span>→ {format(new Date(workshop.end_date), 'MMM dd, yyyy')}</span>}
                  {workshop.start_time && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{workshop.start_time.slice(0, 5)} - {workshop.end_time?.slice(0, 5)}</span>}
                  <span className="flex items-center gap-1"><Users className="h-4 w-4" />{regCount} registered</span>
                </div>
              </div>

              {isUpcoming && <CountdownTimer targetDate={startDt} />}

              {workshop.description && (
                <Card>
                  <CardHeader><CardTitle className="text-lg">About This Workshop</CardTitle></CardHeader>
                  <CardContent><div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: workshop.description }} /></CardContent>
                </Card>
              )}

              {whatYouLearn.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-lg">What You'll Learn</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {whatYouLearn.map((item: string, i: number) => (
                        <li key={i} className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /><span className="text-sm">{item}</span></li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Curriculum */}
              {lessons.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-lg flex items-center gap-2"><BookOpen className="h-5 w-5" />Course Plan</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {lessons.map((l: any, idx: number) => (
                      <div key={l.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <span className="text-xs font-mono bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{l.title}</p>
                            <Badge variant="outline" className="text-[10px]">{l.lesson_type}</Badge>
                          </div>
                          {l.description && <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {workshop.prerequisites && (
                <Card>
                  <CardHeader><CardTitle className="text-lg">Prerequisites</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{workshop.prerequisites}</p></CardContent>
                </Card>
              )}

              {/* Sessions for multi-day */}
              {sessions.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-lg">Schedule</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {sessions.map((s: any) => (
                      <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <Calendar className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">{s.title}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(s.session_date), 'MMM dd')} · {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</p>
                          {s.description && <p className="text-xs mt-1">{s.description}</p>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Materials (visible after registration) */}
              {isRegistered && materials.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-lg">Materials</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {materials.map((m: any, i: number) => (
                      <a key={i} href={m.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded hover:bg-muted text-sm">
                        <Download className="h-4 w-4 text-primary" />
                        <span>{m.name}</span>
                        <Badge variant="outline" className="ml-auto text-[10px]">{m.type || 'file'}</Badge>
                      </a>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Meet Link (only when ongoing + registered) */}
              {isRegistered && (isOngoing || !isUpcoming) && workshop.meet_link && (
                <Card className="border-green-500/30 bg-green-50/50 dark:bg-green-900/10">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Video className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Join Live Session</span>
                    </div>
                    <a href={workshop.meet_link} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="gap-1"><ExternalLink className="h-3.5 w-3.5" />Join Now</Button>
                    </a>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Instructor from profile */}
              {instructor && (
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={instructor.avatar_url || ''} />
                        <AvatarFallback>{instructor.full_name?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm">{instructor.full_name}</p>
                        <p className="text-xs text-muted-foreground">Instructor</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Slots Info */}
              <Card>
                <CardContent className="p-5 space-y-3">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary">{regCount}</p>
                    <p className="text-sm text-muted-foreground">Registered</p>
                    {slotsLeft !== null && (
                      <p className={`text-sm font-medium mt-1 ${isFull ? 'text-destructive' : 'text-green-600'}`}>
                        {isFull ? 'Fully Booked' : `${slotsLeft} slots remaining`}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Registration Form */}
              {isRegistered ? (
                <Card className="border-green-500/30">
                  <CardContent className="p-5 text-center space-y-2">
                    <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
                    <p className="font-semibold">You're Registered!</p>
                    {(regNumber || myRegistration?.registration_number) && (
                      <p className="text-sm text-muted-foreground">Registration #: <strong>{regNumber || myRegistration?.registration_number}</strong></p>
                    )}
                  </CardContent>
                </Card>
              ) : workshop.status !== 'completed' && workshop.status !== 'cancelled' && !isFull ? (
                <Card>
                  <CardHeader><CardTitle className="text-lg">Register Now</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                    <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div><Label>Mobile</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
                    <div><Label>Institution</Label><Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} /></div>
                    <Button className="w-full" onClick={() => registerMutation.mutate()} disabled={registerMutation.isPending}>
                      {registerMutation.isPending ? 'Registering...' : 'Register for Free'}
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    </>
  );
}
