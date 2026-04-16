import { PageSkeleton } from '@/components/ui/loading-skeletons';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CountdownTimer } from '@/components/workshop/CountdownTimer';
import { Calendar, Clock, Users, Download, CheckCircle, Video, BookOpen, FileText, FileImage, FileArchive, File, LogIn, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const fileIcon = (type: string) => {
  if (['pdf'].includes(type)) return <FileText className="h-4 w-4 text-red-500" />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(type)) return <FileImage className="h-4 w-4 text-blue-500" />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(type)) return <FileArchive className="h-4 w-4 text-amber-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
};

export default function WorkshopDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [registered, setRegistered] = useState(false);
  const [regNumber, setRegNumber] = useState('');

  const { data: workshop, isLoading } = useQuery({
    queryKey: ['workshop', slug],
    queryFn: async () => {
      let { data, error } = await supabase
        .from('workshops')
        .select('*, instructor:user_profiles!workshops_instructor_id_fkey(id, full_name, avatar_url)')
        .eq('slug', slug!)
        .maybeSingle();
      if (!data) {
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

  // Redirect UUID URLs to slug URLs
  useEffect(() => {
    if (workshop?.slug && slug !== workshop.slug) {
      navigate(`/workshops/${workshop.slug}`, { replace: true });
    }
  }, [workshop?.slug, slug, navigate]);

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

  const { data: myRegistration, isLoading: regLoading } = useQuery({
    queryKey: ['my-workshop-reg', workshop?.id, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('workshop_registrations').select('*').eq('workshop_id', workshop!.id).eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!workshop?.id && !!user,
  });

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
        body: { to: regData.email, subject: `Workshop Registration Confirmed: ${ws.title}`, html: emailBody },
      });
    } catch { /* Email is non-critical */ }
  };

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error('You must be signed in');
      const payload: any = {
        workshop_id: workshop!.id,
        user_id: user.id,
        full_name: profile.full_name || 'Unknown',
        email: user.email || '',
        mobile: (profile as any).mobile || null,
        institution: null,
      };
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
      queryClient.invalidateQueries({ queryKey: ['my-workshop-reg'] });
      toast.success('Registration successful!');
      sendConfirmationEmail(data, workshop);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Auto-register: when user is logged in, workshop loaded, not already registered, auto-register
  const [autoRegAttempted, setAutoRegAttempted] = useState(false);
  useEffect(() => {
    if (
      !autoRegAttempted &&
      user &&
      profile &&
      workshop &&
      !authLoading &&
      !regLoading &&
      !myRegistration &&
      !registered &&
      workshop.status !== 'completed' &&
      workshop.status !== 'cancelled'
    ) {
      // Check if came from login redirect (has ?register=true)
      const params = new URLSearchParams(window.location.search);
      if (params.get('register') === 'true') {
        setAutoRegAttempted(true);
        registerMutation.mutate();
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [user, profile, workshop, authLoading, regLoading, myRegistration, registered, autoRegAttempted]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><PageSkeleton /></div>;
  if (!workshop) return <div className="min-h-screen flex items-center justify-center"><p>Workshop not found</p></div>;

  const startDt = new Date(`${workshop.start_date}T${workshop.start_time || '00:00'}`);
  const isOngoing = workshop.status === 'ongoing';
  const isUpcoming = startDt > new Date();
  const isLive = isOngoing || (!isUpcoming && workshop.status !== 'completed' && workshop.status !== 'cancelled');
  const slotsLeft = workshop.max_participants ? workshop.max_participants - regCount : null;
  const isFull = slotsLeft !== null && slotsLeft <= 0;
  const isRegistered = !!myRegistration || registered;
  const materials = (workshop.materials as any[]) || [];
  const whatYouLearn = (workshop.what_you_learn as string[]) || [];
  const instructor = (workshop as any).instructor;
  const displayRegNumber = regNumber || myRegistration?.registration_number;

  const handleRegisterClick = () => {
    if (!user) {
      // Redirect to login with return URL
      const returnUrl = `/workshops/${slug}?register=true`;
      navigate(`/auth/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }
    registerMutation.mutate();
  };

  const copyRegNumber = () => {
    if (displayRegNumber) {
      navigator.clipboard.writeText(displayRegNumber);
      toast.success('Registration number copied!');
    }
  };

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
                  {isLive && <Badge className="bg-green-500 text-white border-none animate-pulse">● LIVE NOW</Badge>}
                </div>
                <h1 className="text-2xl md:text-3xl font-heading font-bold mb-2">{workshop.title}</h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{format(new Date(workshop.start_date), 'MMMM dd, yyyy')}</span>
                  {workshop.end_date && <span>→ {format(new Date(workshop.end_date), 'MMM dd, yyyy')}</span>}
                  {workshop.start_time && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{workshop.start_time.slice(0, 5)} - {workshop.end_time?.slice(0, 5)}</span>}
                  <span className="flex items-center gap-1"><Users className="h-4 w-4" />{regCount} registered</span>
                </div>
              </div>

              {/* Start Workshop — Big CTA for live workshops */}
              {isRegistered && isLive && workshop.meet_link && (
                <Card className="border-green-500/40 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                  <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Video className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="font-heading font-semibold text-lg">Workshop is Live!</p>
                        <p className="text-sm text-muted-foreground">Click to join the Google Meet session</p>
                      </div>
                    </div>
                    <a href={workshop.meet_link} target="_blank" rel="noopener noreferrer">
                      <Button size="lg" className="gap-2 bg-green-600 hover:bg-green-700 text-white shadow-lg">
                        <Video className="h-5 w-5" /> Start Workshop
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              )}

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
                        <div className="flex-1">
                          <p className="font-medium text-sm">{s.title}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(s.session_date), 'MMM dd')} · {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</p>
                          {s.description && <p className="text-xs mt-1">{s.description}</p>}
                        </div>
                        {s.meet_link && isRegistered && (
                          <a href={s.meet_link} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="gap-1 text-xs shrink-0">
                              <Video className="h-3 w-3" /> Join
                            </Button>
                          </a>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Materials — downloadable list for registered users */}
              {isRegistered && materials.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Download className="h-5 w-5" /> Materials ({materials.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {materials.map((m: any, i: number) => (
                      <a
                        key={i}
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                      >
                        {fileIcon(m.type || '')}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{m.type || 'file'}</p>
                        </div>
                        <Button variant="outline" size="sm" className="gap-1 shrink-0 text-xs" onClick={(e) => e.stopPropagation()}>
                          <Download className="h-3.5 w-3.5" /> Download
                        </Button>
                      </a>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Materials notice for non-registered */}
              {!isRegistered && materials.length > 0 && (
                <Card className="border-dashed">
                  <CardContent className="p-4 flex items-center gap-3 text-sm text-muted-foreground">
                    <Download className="h-5 w-5 shrink-0" />
                    <span>{materials.length} material{materials.length > 1 ? 's' : ''} available after registration</span>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Instructor */}
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

              {/* Start Workshop sidebar CTA */}
              {isRegistered && isLive && workshop.meet_link && (
                <a href={workshop.meet_link} target="_blank" rel="noopener noreferrer" className="block">
                  <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white" size="lg">
                    <Video className="h-5 w-5" /> Start Workshop
                  </Button>
                </a>
              )}

              {/* Registration Card */}
              {isRegistered ? (
                <Card className="border-green-500/30 bg-gradient-to-b from-green-50/50 to-background dark:from-green-900/10">
                  <CardContent className="p-5 text-center space-y-3">
                    <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
                    <p className="font-heading font-semibold text-lg">You're Registered!</p>
                    {displayRegNumber && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Your Workshop Roll ID</p>
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-lg font-mono font-bold text-primary bg-primary/10 px-4 py-2 rounded-lg">{displayRegNumber}</span>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={copyRegNumber}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Keep this number for your records</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : workshop.status !== 'completed' && workshop.status !== 'cancelled' && !isFull ? (
                <Card>
                  <CardHeader><CardTitle className="text-lg">Register Now</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {user ? (
                      <>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={profile?.avatar_url || ''} />
                            <AvatarFallback>{profile?.full_name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                        <Button className="w-full" onClick={() => registerMutation.mutate()} disabled={registerMutation.isPending}>
                          {registerMutation.isPending ? 'Registering...' : 'Register for Free'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground text-center">Sign in to register for this workshop and get your Workshop Roll ID.</p>
                        <Button className="w-full gap-2" onClick={handleRegisterClick}>
                          <LogIn className="h-4 w-4" /> Sign In & Register
                        </Button>
                        <p className="text-[10px] text-center text-muted-foreground">Don't have an account? You can sign up during the process.</p>
                      </>
                    )}
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
