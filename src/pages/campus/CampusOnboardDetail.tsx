import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { MapPin, Users, Building2, Globe, ArrowLeft, CheckCircle2 } from 'lucide-react';

const CampusOnboardDetail = () => {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: campus, isLoading } = useQuery({
    queryKey: ['campus-onboard-detail', id],
    enabled: !!id,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campus_onboard_requests')
        .select('id, campus_name, area, facilities, student_count, description, subdomain_slug, subdomain_provisioned')
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

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Please sign in first');
      const { error } = await supabase.from('user_profiles').update({ onboarded_campus_id: id }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('You are now registered under this campus');
      queryClient.invalidateQueries({ queryKey: ['campus-registered-count', id] });
      queryClient.invalidateQueries({ queryKey: ['auth-profile'] });
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
        <div className="bg-secondary py-8">
          <div className="container">
            <Button asChild variant="ghost" size="sm" className="mb-3"><Link to="/campus-onboard"><ArrowLeft className="h-4 w-4 mr-1.5" /> Campus Network</Link></Button>
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">{campus.campus_name}</h1>
            </div>
          </div>
        </div>

        <div className="container py-8 max-w-3xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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

          {campus.facilities && (
            <Card className="mb-4"><CardContent className="pt-6">
              <h3 className="font-heading font-bold mb-2">Facilities</h3>
              <p className="text-sm text-foreground/80">{campus.facilities}</p>
            </CardContent></Card>
          )}
          {campus.description && (
            <Card className="mb-6"><CardContent className="pt-6">
              <h3 className="font-heading font-bold mb-2">About</h3>
              <p className="text-sm text-foreground/80">{campus.description}</p>
            </CardContent></Card>
          )}

          {user && (
            <Card>
              <CardContent className="pt-6 text-center space-y-3">
                {isLinked ? (
                  <p className="flex items-center justify-center gap-2 text-emerald-600 font-medium">
                    <CheckCircle2 className="h-5 w-5" /> You're registered under this campus
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Studying at {campus.campus_name}? Link your OTS account so you're counted here.</p>
                    <Button onClick={() => linkMutation.mutate()} disabled={linkMutation.isPending}>
                      {linkMutation.isPending ? 'Linking...' : "I'm a student here"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer /><BottomNav />
    </div>
  );
};

export default CampusOnboardDetail;
