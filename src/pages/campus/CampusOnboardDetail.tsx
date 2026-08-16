import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import GallerySlider from '@/components/campus/GallerySlider';
import NoticeBoard from '@/components/campus/NoticeBoard';
import CampusLeadershipCard from '@/components/campus/CampusLeadershipCard';
import CampusInstructorsSection from '@/components/campus/CampusInstructorsSection';
import CampusStudentsSection from '@/components/campus/CampusStudentsSection';
import { useCampusRealtime } from '@/hooks/useCampusRealtime';
import { MapPin, Users, Building2, Globe, ArrowLeft, CheckCircle2, Image as ImageIcon, CalendarDays, Link as LinkIcon, Sparkles, GraduationCap } from 'lucide-react';

const CampusOnboardDetail = () => {
  const { id } = useParams();
  const { user, profile, roles, refreshProfile } = useAuth();
  const isInstructor = roles?.includes('instructor');
  useCampusRealtime(id);
  const queryClient = useQueryClient();
  const { upload: uploadGalleryFile, uploading: galleryUploading, progress: galleryProgress } = useFileUpload();

  const { data: campus, isLoading } = useQuery({
    queryKey: ['campus-onboard-detail', id],
    enabled: !!id,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campus_onboard_requests')
        .select('id, campus_name, area, facilities, student_count, description, subdomain_slug, subdomain_provisioned, logo_url, cover_image_url, established_year, website_url, full_address, campus_type, highlights, principal_name, principal_designation, principal_photo_url, principal_phone, principal_email')
        .eq('id', id!)
        .eq('status', 'approved')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Live count of students on the main site who selected this as their campus.
  const { data: registeredCount } = useQuery({
    queryKey: ['campus-registered-count', id],
    enabled: !!id,
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('onboarded_campus_id', id!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const isLinked = profile?.onboarded_campus_id === id;

  const { data: gallery = [] } = useQuery({
    queryKey: ['campus-gallery', id],
    enabled: !!id,
    refetchInterval: 45000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campus_gallery_images')
        .select('*')
        .eq('campus_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const addGalleryImage = useMutation({
    mutationFn: async (url: string) => {
      const { error } = await supabase.from('campus_gallery_images').insert({
        campus_id: id, image_url: url, uploaded_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campus-gallery', id] });
      toast.success('Photo added to the campus gallery');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadGalleryFile(file, { folder: 'campus-gallery' });
      addGalleryImage.mutate(result.url);
    } catch (err: any) {
      toast.error(err.message || 'Photo upload failed');
    }
  };

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Please sign in first');
      const { error } = await supabase.from('user_profiles').update({ onboarded_campus_id: id }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success('You are now registered under this campus');
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['campus-registered-count', id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <UtilityBar /><Header />
        <main className="flex-1 flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></main>
        <Footer /><BottomNav />
      </div>
    );
  }

  if (!campus) {
    return (
      <div className="min-h-screen flex flex-col">
        <UtilityBar /><Header />
        <main className="flex-1 flex items-center justify-center py-16">
          <div className="text-center">
            <p className="text-lg font-medium">Campus not found</p>
            <Button asChild variant="outline" className="mt-4"><Link to="/campus-onboard">Back to Campus Network</Link></Button>
          </div>
        </main>
        <Footer /><BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <UtilityBar /><Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div
          className="relative py-8 bg-cover bg-center"
          style={campus.cover_image_url
            ? { backgroundImage: `linear-gradient(rgba(10,15,30,0.55),rgba(10,15,30,0.72)), url(${campus.cover_image_url})` }
            : undefined}
        >
          {!campus.cover_image_url && <div className="absolute inset-0 bg-secondary" />}
          <div className={`relative container ${campus.cover_image_url ? 'text-white' : ''}`}>
            <Button asChild variant="ghost" size="sm" className={`mb-3 ${campus.cover_image_url ? 'hover:bg-white/10 text-white' : ''}`}>
              <Link to="/campus-onboard"><ArrowLeft className="h-4 w-4 mr-1.5" /> Campus Network</Link>
            </Button>
            <div className="flex items-center gap-3">
              {campus.logo_url ? (
                <img src={campus.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/20 shrink-0" />
              ) : (
                <Building2 className="h-8 w-8 text-primary shrink-0" />
              )}
              <div>
                <h1 className="font-heading text-2xl md:text-3xl font-bold">{campus.campus_name}</h1>
                {campus.campus_type && <Badge variant="secondary" className="mt-1">{campus.campus_type}</Badge>}
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8 max-w-3xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card><CardContent className="pt-6 text-center">
              <MapPin className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-sm text-muted-foreground">Area</p>
              <p className="font-semibold">{campus.area}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6 text-center">
              <Users className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-sm text-muted-foreground">Registered on OTS</p>
              <p className="font-semibold tabular-nums">{registeredCount ?? '—'} students</p>
            </CardContent></Card>
            {campus.established_year && (
              <Card><CardContent className="pt-6 text-center">
                <CalendarDays className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-sm text-muted-foreground">Established</p>
                <p className="font-semibold tabular-nums">{campus.established_year}</p>
              </CardContent></Card>
            )}
            <Card><CardContent className="pt-6 text-center">
              <Globe className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-sm text-muted-foreground">Subdomain</p>
              {campus.subdomain_provisioned ? (
                <a href={`https://${campus.subdomain_slug}.onlinetextileschool.com`} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline text-sm break-all">
                  {campus.subdomain_slug}.onlinetextileschool.com
                </a>
              ) : (
                <p className="font-semibold text-muted-foreground text-sm">Coming soon</p>
              )}
            </CardContent></Card>
          </div>

          <div className="mb-6">
            <CampusLeadershipCard
              name={campus.principal_name} designation={campus.principal_designation}
              photoUrl={campus.principal_photo_url} phone={campus.principal_phone} email={campus.principal_email}
            />
          </div>

          {user && (
            <Card className="mb-6">
              <CardContent className="pt-6 text-center space-y-3">
                {isLinked ? (
                  <p className="flex items-center justify-center gap-2 text-emerald-600 font-medium">
                    <CheckCircle2 className="h-5 w-5" /> You're registered under this campus
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {isInstructor ? `Teaching at ${campus.campus_name}?` : `Studying at ${campus.campus_name}?`} Link your OTS account so you're counted here.
                    </p>
                    <Button onClick={() => linkMutation.mutate()} disabled={linkMutation.isPending}>
                      {linkMutation.isPending ? 'Linking...' : isInstructor ? 'I teach here' : "I'm a student here"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="overview">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="instructors">Instructors</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="gallery">Gallery</TabsTrigger>
              <TabsTrigger value="notices">Notices</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 pt-4">
              {campus.highlights && campus.highlights.length > 0 && (
                <Card><CardContent className="pt-6">
                  <h3 className="font-heading font-bold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Highlights</h3>
                  <div className="flex flex-wrap gap-2">
                    {campus.highlights.map((h: string) => <Badge key={h} variant="outline">{h}</Badge>)}
                  </div>
                </CardContent></Card>
              )}
              {campus.description && (
                <Card><CardContent className="pt-6">
                  <h3 className="font-heading font-bold mb-2">About</h3>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{campus.description}</p>
                </CardContent></Card>
              )}
              {campus.facilities && (
                <Card><CardContent className="pt-6">
                  <h3 className="font-heading font-bold mb-2">Facilities</h3>
                  <p className="text-sm text-foreground/80">{campus.facilities}</p>
                </CardContent></Card>
              )}
              {(campus.full_address || campus.website_url) && (
                <Card><CardContent className="pt-6 space-y-2">
                  <h3 className="font-heading font-bold mb-2">Contact & Location</h3>
                  {campus.full_address && (
                    <p className="flex items-start gap-2 text-sm text-foreground/80"><MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {campus.full_address}</p>
                  )}
                  {campus.website_url && (
                    <a href={campus.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <LinkIcon className="h-4 w-4 shrink-0" /> {campus.website_url}
                    </a>
                  )}
                </CardContent></Card>
              )}
            </TabsContent>

            <TabsContent value="instructors" className="pt-4">
              <Card><CardContent className="pt-6">
                <h3 className="font-heading font-bold mb-4 flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Instructors</h3>
                <CampusInstructorsSection campusId={campus.id} />
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="students" className="pt-4">
              <Card><CardContent className="pt-6">
                <h3 className="font-heading font-bold mb-4 flex items-center gap-2"><Users className="h-4 w-4" /> Students</h3>
                <CampusStudentsSection campusId={campus.id} />
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="gallery" className="pt-4">
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h3 className="font-heading font-bold flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Campus Gallery</h3>
                  {isLinked && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">You're a registered {isInstructor ? 'instructor' : 'student'} here — add a photo for the campus's public portfolio.</p>
                      <Input type="file" accept="image/*" onChange={handleGalleryUpload} disabled={galleryUploading} className="text-xs max-w-xs" />
                      {galleryUploading && (
                        <div className="space-y-1 max-w-xs">
                          <Progress value={galleryProgress} className="h-1.5" />
                          <p className="text-xs text-muted-foreground">Uploading... {galleryProgress}%</p>
                        </div>
                      )}
                    </div>
                  )}
                  {gallery.length > 0 ? (
                    <GallerySlider images={gallery} />
                  ) : (
                    <p className="text-xs text-muted-foreground">No photos yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notices" className="pt-4">
              <Card><CardContent className="pt-6">
                <NoticeBoard campusId={campus.id} mode="public" />
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer /><BottomNav />
    </div>
  );
};

export default CampusOnboardDetail;
