import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Crown, Star, Palette, Download, Clock, Building2, Users, ThumbsUp, AlertTriangle, MessageSquare, Share2, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { renderAmbassadorCard, downloadAmbassadorCard } from '@/lib/ambassadorCardRenderer';
import { renderTeamCard, downloadTeamCard } from '@/lib/teamCardRenderer';
import { useCampusAmbassadorTeam } from '@/hooks/useCampusAmbassadorTeam';
import AmbassadorSkillsEditor from '@/components/dashboard/AmbassadorSkillsEditor';
import AmbassadorMessages from '@/components/dashboard/AmbassadorMessages';
import { toast } from 'sonner';

const SUB_ROLE_META: Record<string, { label: string; icon: any }> = {
  head_of_campus: { label: 'Head of Campus Ambassador', icon: Crown },
  ambassador: { label: 'Ambassador', icon: Star },
  graphics_team: { label: 'Graphics Team', icon: Palette },
};

const AmbassadorHub = () => {
  const { user, profile } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [teamPreviewUrl, setTeamPreviewUrl] = useState<string | null>(null);
  const [teamGenerating, setTeamGenerating] = useState(false);

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

  const cardData = application ? {
    fullName: profile?.full_name || 'Ambassador',
    roleLabel: SUB_ROLE_META[application.sub_role]?.label || 'Ambassador',
    campusName: application.campus?.campus_name,
    sessionLabel: application.session?.label,
    avatarUrl: (profile as any)?.avatar_url || null,
  } : null;

  useEffect(() => {
    if (!cardData) return;
    let cancelled = false;
    renderAmbassadorCard(cardData).then((canvas) => {
      if (!cancelled) setPreviewUrl(canvas.toDataURL('image/png'));
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application?.id, profile?.full_name, (profile as any)?.avatar_url]);

  const handleDownload = async () => {
    if (!cardData) return;
    setGenerating(true);
    try {
      await downloadAmbassadorCard(cardData);
      toast.success('Card downloaded — share it on Facebook, Instagram, or LinkedIn!');
    } catch (e: any) {
      toast.error('Could not generate card: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const { data: voteTally } = useQuery({
    queryKey: ['my-ambassador-vote-tally', application?.id],
    enabled: !!application?.id,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ambassador_vote_tally', { _application_id: application!.id });
      if (error) throw error;
      return data?.[0] || { up_votes: 0, down_votes: 0, total_votes: 0, accept_pct: null };
    },
  });

  const { data: team } = useCampusAmbassadorTeam(application?.campus_id, application?.campus?.campus_name);

  useEffect(() => {
    if (!team) return;
    let cancelled = false;
    renderTeamCard(team).then((canvas) => {
      if (!cancelled) setTeamPreviewUrl(canvas.toDataURL('image/png'));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [team]);

  const handleTeamDownload = async () => {
    if (!team) return;
    setTeamGenerating(true);
    try {
      await downloadTeamCard(team);
      toast.success('Team card downloaded!');
    } catch (e: any) {
      toast.error('Could not generate team card: ' + e.message);
    } finally {
      setTeamGenerating(false);
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
          <p className="font-semibold flex items-center gap-2"><Download className="h-4 w-4" /> Share Card — Facebook, Instagram, LinkedIn</p>
          <p className="text-sm text-muted-foreground">A ready-made branded card with your photo, name, role, campus, and session — download and post it to announce yourself as an OTS ambassador.</p>
          {previewUrl ? (
            <img src={previewUrl} alt="Ambassador share card preview" className="w-full max-w-sm rounded-lg border shadow-sm" />
          ) : (
            <div className="w-full max-w-sm aspect-square rounded-lg border flex items-center justify-center bg-muted">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          <Button onClick={handleDownload} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
            Download Share Card
          </Button>
        </CardContent>
      </Card>

      {team && (team.head || team.ambassadors.length > 0 || team.graphics.length > 0) && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Campus Team Card</p>
            <p className="text-sm text-muted-foreground">A full roster card for {team.campusName}'s ambassador team — Head, Ambassadors, and Graphics/Others.</p>
            {teamPreviewUrl ? (
              <img src={teamPreviewUrl} alt="Campus ambassador team card preview" className="w-full max-w-sm rounded-lg border shadow-sm" />
            ) : (
              <div className="w-full max-w-sm aspect-[9/12] rounded-lg border flex items-center justify-center bg-muted">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            <Button onClick={handleTeamDownload} disabled={teamGenerating}>
              {teamGenerating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
              Download Team Card
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="font-semibold flex items-center gap-2"><Share2 className="h-4 w-4" /> Your Public Profile</p>
          <p className="text-sm text-muted-foreground">Share this link — anyone signed in can view your profile and vote on your performance.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted rounded px-2 py-1.5 truncate">{window.location.origin}/ambassador/{application.id}</code>
            <Button
              size="sm" variant="outline"
              onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/ambassador/${application.id}`); toast.success('Link copied!'); }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>

          {voteTally && (
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground"><ThumbsUp className="h-3.5 w-3.5" /> Community Acceptance</span>
                <span className="font-bold">{voteTally.accept_pct != null ? `${voteTally.accept_pct}%` : 'No votes yet'}</span>
              </div>
              <p className="text-xs text-muted-foreground">{voteTally.up_votes} up · {voteTally.down_votes} down · {voteTally.total_votes} total votes {!application.vote_confirmed && '(100 needed within 7 days of approval to confirm)'}</p>
              {application.needs_review && (
                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 text-xs">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-800 dark:text-amber-400">Under Admin Review</p>
                    <p className="text-amber-700 dark:text-amber-500">{application.review_reason}</p>
                  </div>
                </div>
              )}
              {application.vote_confirmed && (
                <Badge className="bg-emerald-600">Community Confirmed</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="font-semibold mb-1">Skills &amp; Interests</p>
          <AmbassadorSkillsEditor applicationId={application.id} currentSkills={application.skills || []} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Message Admin</p>
          <AmbassadorMessages applicationId={application.id} asAdmin={false} />
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
