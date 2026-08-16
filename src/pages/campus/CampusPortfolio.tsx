import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GallerySlider from '@/components/campus/GallerySlider';
import NoticeBoard from '@/components/campus/NoticeBoard';
import CampusLeadershipCard from '@/components/campus/CampusLeadershipCard';
import CampusInstructorsSection from '@/components/campus/CampusInstructorsSection';
import CampusStudentsSection from '@/components/campus/CampusStudentsSection';
import FabricLibrarySection from '@/components/campus/FabricLibrarySection';
import { useCampusRealtime } from '@/hooks/useCampusRealtime';
import { Building2, MapPin, Users, Mail, Phone, GraduationCap, Image as ImageIcon, CalendarDays, Link as LinkIcon, Sparkles } from 'lucide-react';

interface Props {
  slug: string;
}

const CampusPortfolio = ({ slug }: Props) => {
  const { data: campus, isLoading } = useQuery({
    queryKey: ['campus-portfolio', slug],
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campus_onboard_requests')
        .select('id, campus_name, area, facilities, description, student_count, departments, logo_url, cover_image_url, contact_email, contact_phone, established_year, website_url, full_address, campus_type, highlights, principal_name, principal_designation, principal_photo_url, principal_phone, principal_email')
        .eq('subdomain_slug', slug)
        .eq('status', 'approved')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: registeredCount } = useQuery({
    queryKey: ['campus-registered-count', campus?.id],
    enabled: !!campus?.id,
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('onboarded_campus_id', campus!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: gallery = [] } = useQuery({
    queryKey: ['campus-gallery', campus?.id],
    enabled: !!campus?.id,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campus_gallery_images')
        .select('id, image_url')
        .eq('campus_id', campus!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  useCampusRealtime(campus?.id);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (!campus) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-lg font-medium">This campus page isn't available</p>
          <p className="text-muted-foreground text-sm mt-1">It may not be approved yet, or the link is incorrect.</p>
          <a href="https://www.onlinetextileschool.com" className="text-primary hover:underline text-sm mt-4 inline-block">
            Visit Online Textile School →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div
        className="relative text-primary-foreground py-20 sm:py-24 bg-cover bg-center"
        style={campus.cover_image_url
          ? { backgroundImage: `linear-gradient(rgba(10,15,30,0.55),rgba(10,15,30,0.72)), url(${campus.cover_image_url})` }
          : undefined}
      >
        {!campus.cover_image_url && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-dark to-accent" />
        )}
        <div className="relative container mx-auto px-4 max-w-4xl text-center">
          {campus.logo_url ? (
            <img src={campus.logo_url} alt={campus.campus_name} className="w-24 h-24 rounded-2xl mx-auto mb-5 object-cover border-4 border-white/30 shadow-xl" />
          ) : (
            <div className="w-24 h-24 rounded-2xl mx-auto mb-5 bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
              <Building2 className="h-10 w-10" />
            </div>
          )}
          <h1 className="font-heading text-3xl md:text-5xl font-black mb-3 drop-shadow-sm">{campus.campus_name}</h1>
          <p className="flex items-center justify-center gap-1.5 opacity-90 text-base">
            <MapPin className="h-4 w-4" /> {campus.area}
          </p>
          {campus.campus_type && <Badge variant="secondary" className="mt-3">{campus.campus_type}</Badge>}
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 max-w-4xl py-10 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-6 text-center">
            <Users className="h-6 w-6 mx-auto text-primary mb-1.5" />
            <p className="text-2xl font-heading font-black tabular-nums">{registeredCount ?? '—'}</p>
            <p className="text-sm text-muted-foreground">Students on Online Textile School</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <GraduationCap className="h-6 w-6 mx-auto text-primary mb-1.5" />
            <p className="text-2xl font-heading font-black tabular-nums">{campus.departments?.length ?? 0}</p>
            <p className="text-sm text-muted-foreground">Departments</p>
          </CardContent></Card>
          {campus.established_year && (
            <Card><CardContent className="pt-6 text-center">
              <CalendarDays className="h-6 w-6 mx-auto text-primary mb-1.5" />
              <p className="text-2xl font-heading font-black tabular-nums">{campus.established_year}</p>
              <p className="text-sm text-muted-foreground">Established</p>
            </CardContent></Card>
          )}
        </div>

        <CampusLeadershipCard
          name={campus.principal_name} designation={campus.principal_designation}
          photoUrl={campus.principal_photo_url} phone={campus.principal_phone} email={campus.principal_email}
        />

        <Tabs defaultValue="overview">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="instructors">Instructors</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
            <TabsTrigger value="notices">Notices</TabsTrigger>
            <TabsTrigger value="fabric-library">Fabric Library</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 pt-4">
            {campus.highlights && campus.highlights.length > 0 && (
              <Card><CardContent className="pt-6">
                <h3 className="font-heading font-bold mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Highlights</h3>
                <div className="flex flex-wrap gap-2">
                  {campus.highlights.map((h: string) => <Badge key={h} variant="outline">{h}</Badge>)}
                </div>
              </CardContent></Card>
            )}

            {campus.departments && campus.departments.length > 0 && (
              <Card><CardContent className="pt-6">
                <h3 className="font-heading font-bold mb-3">Departments</h3>
                <div className="flex flex-wrap gap-2">
                  {campus.departments.map((d: string) => <Badge key={d} variant="secondary">{d}</Badge>)}
                </div>
              </CardContent></Card>
            )}

            {campus.facilities && (
              <Card><CardContent className="pt-6">
                <h3 className="font-heading font-bold mb-2">Facilities</h3>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{campus.facilities}</p>
              </CardContent></Card>
            )}

            {campus.description && (
              <Card><CardContent className="pt-6">
                <h3 className="font-heading font-bold mb-2">About</h3>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{campus.description}</p>
              </CardContent></Card>
            )}

            {(campus.contact_email || campus.contact_phone || campus.website_url || campus.full_address) && (
              <Card><CardContent className="pt-6 space-y-2">
                <h3 className="font-heading font-bold mb-2">Contact</h3>
                {campus.full_address && (
                  <p className="flex items-start gap-2 text-sm text-foreground/80"><MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {campus.full_address}</p>
                )}
                {campus.contact_email && (
                  <p className="flex items-center gap-2 text-sm text-foreground/80"><Mail className="h-4 w-4 text-primary" /> {campus.contact_email}</p>
                )}
                {campus.contact_phone && (
                  <p className="flex items-center gap-2 text-sm text-foreground/80"><Phone className="h-4 w-4 text-primary" /> {campus.contact_phone}</p>
                )}
                {campus.website_url && (
                  <a href={campus.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <LinkIcon className="h-4 w-4" /> {campus.website_url}
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
            {gallery.length > 0 ? (
              <Card><CardContent className="pt-6">
                <h3 className="font-heading font-bold mb-3 flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Gallery</h3>
                <GallerySlider images={gallery} />
              </CardContent></Card>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No gallery photos yet.</p>
            )}
          </TabsContent>

          <TabsContent value="notices" className="pt-4">
            <Card><CardContent className="pt-6">
              <NoticeBoard campusId={campus.id} mode="public" />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="fabric-library" className="pt-4">
            <Card><CardContent className="pt-6">
              <FabricLibrarySection campusId={campus.id} mode="public" />
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Powered by{' '}
        <a href="https://www.onlinetextileschool.com" className="text-primary hover:underline font-medium">
          Online Textile School
        </a>
      </footer>
    </div>
  );
};

export default CampusPortfolio;
