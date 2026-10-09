import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Crown, Star, Palette, Download, Clock, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { downloadAmbassadorCard } from '@/lib/ambassadorCardRenderer';
import { toast } from 'sonner';

const SUB_ROLE_META: Record<string, { label: string; icon: any }> = {
  head_of_campus: { label: 'Head of Campus Ambassador', icon: Crown },
  ambassador: { label: 'Ambassador', icon: Star },
  graphics_team: { label: 'Graphics Team', icon: Palette },
};

const AmbassadorHub = () => {
  const { user, profile } = useAuth();
  const [generating, setGenerating] = useState(false);

  const { data: application, isLoading } = useQuery({
    queryKey: ['my-ambassador-app-full', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('ambassador_applications')
        .select('*, campus:campus_onboard_requests(campus_name), session:ambassador_sessions(label)')
        .eq('user_id', user!.id)
        .eq('status', 'approved')
        .maybeSingle();
      return data;
    },
  });

  const handleDownload = async () => {
    if (!application) return;
    setGenerating(true);
    try {
      await downloadAmbassadorCard({
        fullName: profile?.full_name || 'Ambassador',
        roleLabel: SUB_ROLE_META[application.sub_role]?.label || 'Ambassador',
        campusName: application.campus?.campus_name,
        sessionLabel: application.session?.label,
        avatarUrl: (profile as any)?.avatar_url || null,
      });
      toast.success('Card downloaded — share it on Facebook!');
    } catch (e: any) {
      toast.error('Could not generate card: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!application) {
    return (
      <Card><CardContent className="p-8 text-center text-muted-foreground">
        You don't have an approved ambassador application. Apply from Settings.
      </CardContent></Card>
    );
  }

  const meta = SUB_ROLE_META[application.sub_role];
  const Icon = meta?.icon || Star;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Icon className="h-6 w-6 text-primary" /> Ambassador Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">{meta?.label}{application.campus?.campus_name && ` · ${application.campus.campus_name}`}{application.session?.label && ` · ${application.session.label}`}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Points</p>
            <p className="text-3xl font-heading font-bold text-primary">{application.points}</p>
            <p className="text-xs text-muted-foreground mt-1">Awarded by admin for your ambassador activities. Redeemable for OTS features — coming soon.</p>
          </CardContent>
        </Card>
        {application.campus_id && application.sub_role !== 'graphics_team' && (
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Campus Access</p>
              <p className="text-sm mt-2">You can manage {application.campus?.campus_name}'s posts, notices, gallery, and events.</p>
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link to="/dashboard/campus">Open Campus Onboard</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="font-semibold flex items-center gap-2"><Download className="h-4 w-4" /> Facebook Share Card</p>
          <p className="text-sm text-muted-foreground">A ready-made branded card with your name, role, campus, and session — download and post it to announce yourself as an OTS ambassador.</p>
          <Button onClick={handleDownload} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
            Download Share Card
          </Button>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="p-5 space-y-1">
          <p className="font-semibold flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> Daily Activity Updates</p>
          <p className="text-sm text-muted-foreground">Coming soon — you'll be able to log your daily ambassador activities here.</p>
        </CardContent>
      </Card>

    </div>
  );
};

export default AmbassadorHub;
