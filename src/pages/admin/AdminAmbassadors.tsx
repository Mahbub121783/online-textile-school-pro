import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader2, Crown, Star, Palette, Plus, Trash2, Minus, Download, Users, AlertTriangle, MessageSquare, ThumbsUp } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { downloadTeamCard, renderTeamCard } from '@/lib/teamCardRenderer';
import { useCampusAmbassadorTeam } from '@/hooks/useCampusAmbassadorTeam';
import AmbassadorMessages from '@/components/dashboard/AmbassadorMessages';

const SUB_ROLE_META: Record<string, { label: string; icon: any }> = {
  head_of_campus: { label: 'Head of Campus Ambassador', icon: Crown },
  ambassador: { label: 'Ambassador', icon: Star },
  graphics_team: { label: 'Graphics Team', icon: Palette },
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const AmbassadorVoteSummary = ({ applicationId, voteConfirmed, votingDeadline }: { applicationId: string; voteConfirmed: boolean; votingDeadline: string | null }) => {
  const { data: tally } = useQuery({
    queryKey: ['admin-ambassador-vote-tally', applicationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ambassador_vote_tally', { _application_id: applicationId });
      if (error) throw error;
      return data?.[0] || { up_votes: 0, down_votes: 0, total_votes: 0, accept_pct: null };
    },
  });
  if (!tally) return null;
  const deadlinePassed = votingDeadline && new Date(votingDeadline) < new Date();
  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
      <ThumbsUp className="h-3 w-3" /> {tally.accept_pct != null ? `${tally.accept_pct}%` : '—'} acceptance ({tally.total_votes} votes)
      {voteConfirmed
        ? <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30">Confirmed</Badge>
        : votingDeadline && !deadlinePassed
          ? <span>· {formatDistanceToNow(new Date(votingDeadline))} left to reach 100</span>
          : null}
    </p>
  );
};

const ApplicationsTab = () => {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pointsTarget, setPointsTarget] = useState<any | null>(null);
  const [pointsDelta, setPointsDelta] = useState('');
  const [messageTarget, setMessageTarget] = useState<any | null>(null);
  const [filter, setFilter] = useState('pending');

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['admin-ambassador-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_applications')
        .select('*, profile:user_profiles(full_name, roll_id), campus:campus_onboard_requests(campus_name), session:ambassador_sessions(label)')
        .order('applied_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ambassador_applications').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-ambassador-applications'] }); toast.success('Ambassador approved'); },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from('ambassador_applications').update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-ambassador-applications'] }); toast.success('Application rejected'); setRejectTarget(null); setRejectReason(''); },
    onError: (e: any) => toast.error(e.message),
  });

  const pointsMutation = useMutation({
    mutationFn: async ({ id, points }: { id: string; points: number }) => {
      const { error } = await supabase.from('ambassador_applications').update({ points }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-ambassador-applications'] }); toast.success('Points updated'); setPointsTarget(null); setPointsDelta(''); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ambassador_applications').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-ambassador-applications'] }); toast.success('Application deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const resolveReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ambassador_applications').update({ needs_review: false, review_reason: null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-ambassador-applications'] }); toast.success('Review cleared'); },
    onError: (e: any) => toast.error(e.message),
  });

  const needsReviewCount = applications.filter((a: any) => a.needs_review).length;
  const filtered = filter === 'needs_review'
    ? applications.filter((a: any) => a.needs_review)
    : applications.filter((a: any) => filter === 'all' || a.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} className="capitalize">{f}</Button>
        ))}
        <Button
          size="sm" variant={filter === 'needs_review' ? 'default' : 'outline'}
          className={filter !== 'needs_review' && needsReviewCount > 0 ? 'border-amber-400 text-amber-700 dark:text-amber-400' : ''}
          onClick={() => setFilter('needs_review')}
        >
          Needs Review {needsReviewCount > 0 && `(${needsReviewCount})`}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No {filter !== 'all' ? filter : ''} applications.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((a: any) => {
            const meta = SUB_ROLE_META[a.sub_role];
            const Icon = meta?.icon || Star;
            return (
              <Card key={a.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <p className="font-semibold text-sm truncate">{a.profile?.full_name || a.user_id.slice(0, 8)}</p>
                    </div>
                    <Badge className={`${STATUS_COLORS[a.status]} capitalize shrink-0`}>{a.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.profile?.roll_id}</p>
                  <p className="text-sm">{meta?.label}{a.campus?.campus_name && ` · ${a.campus.campus_name}`}{a.session?.label && ` · ${a.session.label}`}</p>
                  <p className="text-xs text-muted-foreground">Applied {format(new Date(a.applied_at), 'dd MMM yyyy')} · Points: <span className="font-bold text-foreground">{a.points}</span></p>
                  {a.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {a.skills.map((s: string) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                    </div>
                  )}
                  {a.rejection_reason && <p className="text-xs text-destructive">Rejected: {a.rejection_reason}</p>}
                  {a.status === 'approved' && <AmbassadorVoteSummary applicationId={a.id} voteConfirmed={a.vote_confirmed} votingDeadline={a.voting_deadline} />}
                  {a.needs_review && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2 text-xs space-y-1">
                      <p className="font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Needs Review</p>
                      <p className="text-amber-700 dark:text-amber-500">{a.review_reason}</p>
                      <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => resolveReviewMutation.mutate(a.id)} disabled={resolveReviewMutation.isPending}>
                        Clear Review
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 flex-wrap">
                    {a.status === 'pending' && (
                      <>
                        <Button size="sm" className="flex-1" onClick={() => approveMutation.mutate(a.id)} disabled={approveMutation.isPending}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="flex-1" onClick={() => setRejectTarget(a.id)}>
                          <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
                        </Button>
                      </>
                    )}
                    {a.status === 'approved' && (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => { setPointsTarget(a); setPointsDelta(''); }}>
                        Adjust Points
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setMessageTarget(a)}>
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive px-2" onClick={() => { if (confirm('Delete this application?')) deleteMutation.mutate(a.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!messageTarget} onOpenChange={(o) => !o && setMessageTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Messages — {messageTarget?.profile?.full_name}</DialogTitle></DialogHeader>
          {messageTarget && <AmbassadorMessages applicationId={messageTarget.id} asAdmin />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Ambassador Application</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget, reason: rejectReason })} disabled={rejectMutation.isPending}>Confirm Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pointsTarget} onOpenChange={(o) => !o && setPointsTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Points — {pointsTarget?.profile?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Current points: {pointsTarget?.points}</Label>
            <Input type="number" placeholder="e.g. 10 or -5" value={pointsDelta} onChange={(e) => setPointsDelta(e.target.value)} />
            <p className="text-xs text-muted-foreground">Enter the amount to add (positive) or subtract (negative).</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPointsTarget(null)}>Cancel</Button>
            <Button
              onClick={() => pointsTarget && pointsMutation.mutate({ id: pointsTarget.id, points: Math.max(0, (pointsTarget.points || 0) + (parseInt(pointsDelta, 10) || 0)) })}
              disabled={pointsMutation.isPending || !pointsDelta}
            >
              {pointsMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SessionsTab = () => {
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState('');

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['admin-ambassador-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ambassador_sessions').select('*').order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (label: string) => {
      const { error } = await supabase.from('ambassador_sessions').insert({ label, sort_order: sessions.length });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-ambassador-sessions'] }); setNewLabel(''); toast.success('Session added'); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('ambassador_sessions').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-ambassador-sessions'] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ambassador_sessions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-ambassador-sessions'] }); toast.success('Session removed'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex gap-2">
        <Input placeholder="e.g. Spring 2026" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        <Button onClick={() => addMutation.mutate(newLabel)} disabled={addMutation.isPending || !newLabel.trim()}>
          <Plus className="h-4 w-4 mr-1.5" /> Add
        </Button>
      </div>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
        <div className="space-y-2">
          {sessions.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between gap-2 border rounded-lg p-2.5">
              <span className={`text-sm ${!s.is_active ? 'text-muted-foreground line-through' : ''}`}>{s.label}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => toggleMutation.mutate({ id: s.id, is_active: !s.is_active })}>
                  {s.is_active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive px-2" onClick={() => { if (confirm(`Delete session "${s.label}"?`)) deleteMutation.mutate(s.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {sessions.length === 0 && <p className="text-sm text-muted-foreground">No sessions yet — add one above.</p>}
        </div>
      )}
    </div>
  );
};

const TeamCardsTab = () => {
  const [campusId, setCampusId] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: campuses = [] } = useQuery({
    queryKey: ['campuses-with-ambassadors'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ambassador_applications')
        .select('campus:campus_onboard_requests(id, campus_name)')
        .eq('status', 'approved')
        .not('campus_id', 'is', null);
      const map = new Map<string, string>();
      (data ?? []).forEach((r: any) => { if (r.campus?.id) map.set(r.campus.id, r.campus.campus_name); });
      return [...map.entries()].map(([id, campus_name]) => ({ id, campus_name })).sort((a, b) => a.campus_name.localeCompare(b.campus_name));
    },
  });

  const selectedCampus = campuses.find((c: any) => c.id === campusId);
  const { data: team } = useCampusAmbassadorTeam(campusId || null, selectedCampus?.campus_name);

  useEffect(() => {
    setPreviewUrl(null);
    if (!team) return;
    let cancelled = false;
    renderTeamCard(team).then((canvas) => { if (!cancelled) setPreviewUrl(canvas.toDataURL('image/png')); }).catch(() => {});
    return () => { cancelled = true; };
  }, [team]);

  const handleDownload = async () => {
    if (!team) return;
    setGenerating(true);
    try {
      await downloadTeamCard(team, `ots-${selectedCampus?.campus_name.toLowerCase().replace(/\s+/g, '-')}-team-card.png`);
      toast.success('Team card downloaded');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4 max-w-sm">
      <div className="space-y-2">
        <Label>Campus</Label>
        <Select value={campusId} onValueChange={setCampusId}>
          <SelectTrigger><SelectValue placeholder="Select a campus" /></SelectTrigger>
          <SelectContent>
            {campuses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.campus_name}</SelectItem>)}
          </SelectContent>
        </Select>
        {campuses.length === 0 && <p className="text-xs text-muted-foreground">No campus has approved ambassadors yet.</p>}
      </div>

      {campusId && (
        previewUrl ? (
          <img src={previewUrl} alt="Team card preview" className="w-full rounded-lg border shadow-sm" />
        ) : (
          <div className="w-full aspect-[9/12] rounded-lg border flex items-center justify-center bg-muted">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )
      )}

      {campusId && (
        <Button onClick={handleDownload} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
          Download Team Card
        </Button>
      )}
    </div>
  );
};

const AdminAmbassadors = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Ambassador Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Review ambassador applications, approve/reject, adjust points, and manage selectable sessions.</p>
      </div>
      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="team-cards"><Users className="h-3.5 w-3.5 mr-1.5" /> Team Cards</TabsTrigger>
        </TabsList>
        <TabsContent value="applications" className="pt-4"><ApplicationsTab /></TabsContent>
        <TabsContent value="sessions" className="pt-4"><SessionsTab /></TabsContent>
        <TabsContent value="team-cards" className="pt-4"><TeamCardsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAmbassadors;
