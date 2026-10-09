import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Crown, Star, Palette, Building2, ArrowLeft, Lock, GraduationCap } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

const SUB_ROLE_META: Record<string, { label: string; icon: any }> = {
  head_of_campus: { label: 'Head of Campus Ambassador', icon: Crown },
  ambassador: { label: 'Ambassador', icon: Star },
  graphics_team: { label: 'Graphics Team', icon: Palette },
};

const AmbassadorProfile = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: ambassador, isLoading } = useQuery({
    queryKey: ['ambassador-profile', id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_applications')
        .select('*, profile:user_profiles(full_name, avatar_url, roll_id, headline, bio, university, department, batch, facebook_url, linkedin_url), campus:campus_onboard_requests(id, campus_name, logo_url), session:ambassador_sessions(label)')
        .eq('id', id)
        .eq('status', 'approved')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center space-y-4">
              <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
              <div>
                <p className="font-semibold">Sign in to view this ambassador's profile</p>
                <p className="text-sm text-muted-foreground mt-1">Ambassador profile details are only visible to signed-in OTS members.</p>
              </div>
              <Button onClick={() => navigate(`/auth/login?redirect=/ambassador/${id}`)}>Sign In</Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!ambassador) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Ambassador not found.</p>
        </div>
        <Footer />
      </div>
    );
  }

  const meta = SUB_ROLE_META[ambassador.sub_role];
  const Icon = meta?.icon || Star;
  const p = ambassador.profile;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/ambassadors"><ArrowLeft className="h-4 w-4 mr-1" /> Ambassadors</Link>
        </Button>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                {p?.avatar_url
                  ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-2xl font-bold">{(p?.full_name || '?')[0]}</span>}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-heading font-bold truncate">{p?.full_name || 'Ambassador'}</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-primary" /> {meta?.label}</p>
                {p?.roll_id && <p className="text-xs text-muted-foreground font-mono">{p.roll_id}</p>}
              </div>
            </div>

            {p?.headline && <p className="text-sm font-medium">{p.headline}</p>}
            {p?.bio && <p className="text-sm text-muted-foreground">{p.bio}</p>}

            <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t">
              {ambassador.campus?.campus_name && (
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Campus</p>
                  <p className="font-medium">{ambassador.campus.campus_name}</p>
                </div>
              )}
              {ambassador.session?.label && (
                <div>
                  <p className="text-xs text-muted-foreground">Session</p>
                  <p className="font-medium">{ambassador.session.label}</p>
                </div>
              )}
              {p?.university && (
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><GraduationCap className="h-3 w-3" /> University</p>
                  <p className="font-medium">{p.university}</p>
                </div>
              )}
              {p?.department && (
                <div>
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="font-medium">{p.department}{p.batch ? ` · ${p.batch}` : ''}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Points</p>
                <p className="font-bold text-primary">{ambassador.points}</p>
              </div>
            </div>

            {(p?.facebook_url || p?.linkedin_url) && (
              <div className="flex gap-3 pt-2 border-t text-sm">
                {p.facebook_url && <a href={p.facebook_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Facebook</a>}
                {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">LinkedIn</a>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default AmbassadorProfile;
