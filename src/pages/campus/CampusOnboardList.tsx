import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { MapPin, Users, Building2, Plus, School } from 'lucide-react';

const CampusOnboardList = () => {
  const { data: campuses = [], isLoading } = useQuery({
    queryKey: ['campus-onboard-approved'],
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data } = await supabase
        .from('campus_onboard_requests')
        .select('id, campus_name, area, facilities, student_count, subdomain_slug, subdomain_provisioned')
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
              {campuses.map((c: any) => (
                <Link key={c.id} to={`/campus-onboard/${c.id}`}>
                  <Card className="hover:shadow-md transition-shadow h-full">
                    <CardContent className="pt-6 space-y-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary shrink-0" />
                        <h3 className="font-heading font-bold text-lg leading-tight">{c.campus_name}</h3>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" /> {c.area}
                      </div>
                      {c.student_count != null && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Users className="h-3.5 w-3.5 shrink-0" /> {c.student_count} students
                        </div>
                      )}
                      {c.facilities && <p className="text-sm text-foreground/80 line-clamp-2">{c.facilities}</p>}
                      {c.subdomain_provisioned && (
                        <span className="text-xs text-primary hover:underline block">
                          {c.subdomain_slug}.onlinetextileschool.com
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer /><BottomNav />
    </div>
  );
};

export default CampusOnboardList;
