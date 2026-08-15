import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { MapPin, Users, Building2, Plus, School, ArrowUpRight } from 'lucide-react';

const CampusOnboardList = () => {
  const { data: campuses = [], isLoading } = useQuery({
    queryKey: ['campus-onboard-approved'],
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data } = await supabase
        .from('campus_onboard_requests')
        .select('id, campus_name, area, facilities, student_count, subdomain_slug, subdomain_provisioned, logo_url, cover_image_url')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <UtilityBar /><Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="bg-secondary py-8">
          <div className="container flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Campus Network</h1>
              <p className="text-muted-foreground mt-1">Partner campuses onboarded to Online Textile School</p>
            </div>
            <Button asChild className="bg-accent hover:bg-accent-hover text-accent-foreground">
              <Link to="/campus-onboard/register"><Plus className="h-4 w-4 mr-2" /> Onboard Your Campus</Link>
            </Button>
          </div>
        </div>

        <div className="container py-8">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-16">Loading...</p>
          ) : campuses.length === 0 ? (
            <div className="text-center py-16">
              <School className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-lg font-medium">No campuses onboarded yet</p>
              <p className="text-muted-foreground text-sm mt-1">Be the first to bring your campus into the network.</p>
              <Button asChild className="mt-4"><Link to="/campus-onboard/register">Register Your Campus</Link></Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {campuses.map((c: any) => {
                // A live campus goes straight to its own subdomain portfolio;
                // one still awaiting subdomain setup falls back to the
                // internal detail page (nothing to link out to yet).
                const CardWrapper = c.subdomain_provisioned ? 'a' : Link;
                const wrapperProps = c.subdomain_provisioned
                  ? { href: `https://${c.subdomain_slug}.onlinetextileschool.com`, target: '_blank', rel: 'noopener noreferrer' }
                  : { to: `/campus-onboard/${c.id}` };
                return (
                  <CardWrapper key={c.id} {...(wrapperProps as any)} className="group">
                    <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all h-full overflow-hidden">
                      <div
                        className="h-28 flex items-center justify-center relative bg-cover bg-center"
                        style={c.cover_image_url
                          ? { backgroundImage: `linear-gradient(rgba(10,15,30,0.35),rgba(10,15,30,0.5)), url(${c.cover_image_url})` }
                          : undefined}
                      >
                        {!c.cover_image_url && (
                          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-dark to-accent" />
                        )}
                        {c.logo_url ? (
                          <img src={c.logo_url} alt={c.campus_name} className="w-16 h-16 rounded-xl object-cover border-2 border-white/40 shadow-lg" />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-white/15 flex items-center justify-center">
                            <Building2 className="h-7 w-7 text-primary-foreground" />
                          </div>
                        )}
                        {c.subdomain_provisioned && (
                          <ArrowUpRight className="h-4 w-4 text-primary-foreground/80 absolute top-3 right-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        )}
                      </div>
                      <CardContent className="pt-4 space-y-2">
                        <h3 className="font-heading font-bold text-lg leading-tight truncate">{c.campus_name}</h3>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" /> {c.area}
                        </div>
                        {c.student_count != null && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Users className="h-3.5 w-3.5 shrink-0" /> {c.student_count} students
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </CardWrapper>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer /><BottomNav />
    </div>
  );
};

export default CampusOnboardList;
