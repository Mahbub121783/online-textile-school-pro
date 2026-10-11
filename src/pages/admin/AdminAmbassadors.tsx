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
import { CheckCircle, XCircle, Loader2, Crown, Star, Palette, Plus, Trash2, Minus, Download, Users, AlertTriangle, MessageSquare, ThumbsUp, Pencil, Trophy, UserPlus, LogIn, ShoppingCart, Megaphone, Award, Search, Medal, FileDown } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import jsPDF from 'jspdf';
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

const ACTIVITY_META: Record<string, { label: string; icon: any }> = {
  referral_signup: { label: 'Referral signups', icon: UserPlus },
  referral_login: { label: 'Referred logins', icon: LogIn },
  referral_purchase: { label: 'Referred purchases', icon: ShoppingCart },
  campus_post: { label: 'Campus wall posts', icon: Megaphone },
  admin_assigned: { label: 'Admin-assigned tasks', icon: Award },
};

const AddActivityButton = ({ application }: { application: any }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [points, setPoints] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ambassador_activity_log').insert({
        application_id: application.id,
        activity_type: 'admin_assigned',
        points: parseInt(points, 10) || 0,
        note: note.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ambassador-applications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-ambassador-ranking'] });
      queryClient.invalidateQueries({ queryKey: ['admin-ambassador-activity-breakdown', application.id] });
      toast.success('Activity added');
      setOpen(false); setNote(''); setPoints('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} title="Add Activity">
        <Award className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Activity — {application.profile?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>What extra task did they do?</Label>
              <Textarea placeholder="e.g. Organized the spring onboarding webinar" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Points to award</Label>
              <Input type="number" placeholder="e.g. 20" value={points} onChange={(e) => setPoints(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">This is logged (unlike the quick points adjustment below) so it shows up in their activity stats as proof of work.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !note.trim() || !points}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const AmbassadorActivityBreakdown = ({ applicationId }: { applicationId: string }) => {
  const { data } = useQuery({
    queryKey: ['admin-ambassador-activity-breakdown', applicationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ambassador_activity_breakdown', { _application_id: applicationId });
      if (error) throw error;
      return data || [];
    },
  });
  if (!data || data.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {data.map((row: any) => {
        const meta = ACTIVITY_META[row.activity_type];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <span key={row.activity_type} className="text-[10px] bg-muted rounded px-1.5 py-0.5 flex items-center gap-1" title={meta.label}>
            <Icon className="h-3 w-3" /> {row.cnt} (+{row.total_points})
          </span>
        );
      })}
    </div>
  );
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
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editCampusId, setEditCampusId] = useState('');
  const [editSubRole, setEditSubRole] = useState('');
  const [editSessionId, setEditSessionId] = useState('');
  const [filter, setFilter] = useState('pending');
  const [sortByPoints, setSortByPoints] = useState(false);

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

  const { data: allCampuses = [] } = useQuery({
    queryKey: ['admin-all-campuses-for-ambassador-edit'],
    queryFn: async () => {
      const { data, error } = await supabase.from('campus_onboard_requests').select('id, campus_name, status').order('campus_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allSessions = [] } = useQuery({
    queryKey: ['admin-ambassador-sessions-for-edit'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ambassador_sessions').select('id, label').order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
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

  const editMutation = useMutation({
    mutationFn: async ({ id, campus_id, sub_role, session_id }: { id: string; campus_id: string | null; sub_role: string; session_id: string | null }) => {
      const { error } = await supabase.from('ambassador_applications').update({ campus_id, sub_role, session_id }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-ambassador-applications'] }); toast.success('Ambassador updated'); setEditTarget(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const needsReviewCount = applications.filter((a: any) => a.needs_review).length;
  const filtered = (filter === 'needs_review'
    ? applications.filter((a: any) => a.needs_review)
    : applications.filter((a: any) => filter === 'all' || a.status === filter)
  ).slice().sort((a: any, b: any) => sortByPoints ? (b.points - a.points) : 0);

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
        <Button size="sm" variant={sortByPoints ? 'default' : 'outline'} onClick={() => setSortByPoints((v) => !v)} className="ml-auto">
          <Trophy className="h-3.5 w-3.5 mr-1.5" /> Rank by Points
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No {filter !== 'all' ? filter : ''} applications.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((a: any, idx: number) => {
            const meta = SUB_ROLE_META[a.sub_role];
            const Icon = meta?.icon || Star;
            return (
              <Card key={a.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {sortByPoints && <span className="text-xs font-bold text-muted-foreground shrink-0">#{idx + 1}</span>}
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <p className="font-semibold text-sm truncate">{a.profile?.full_name || a.user_id.slice(0, 8)}</p>
                    </div>
                    <Badge className={`${STATUS_COLORS[a.status]} capitalize shrink-0`}>{a.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.profile?.roll_id}</p>
                  <p className="text-sm">{meta?.label}{a.campus?.campus_name && ` · ${a.campus.campus_name}`}{a.session?.label && ` · ${a.session.label}`}</p>
                  <p className="text-xs text-muted-foreground">Applied {format(new Date(a.applied_at), 'dd MMM yyyy')} · Points: <span className="font-bold text-foreground">{a.points}</span></p>
                  <AmbassadorActivityBreakdown applicationId={a.id} />
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
                      <>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => { setPointsTarget(a); setPointsDelta(''); }}>
                          Adjust Points
                        </Button>
                        <AddActivityButton application={a} />
                      </>
                    )}
                    <Button
                      size="sm" variant="outline"
                      onClick={() => { setEditTarget(a); setEditCampusId(a.campus_id || ''); setEditSubRole(a.sub_role); setEditSessionId(a.session_id || ''); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
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

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Ambassador — {editTarget?.profile?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={editSubRole} onValueChange={setEditSubRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SUB_ROLE_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Campus {editSubRole !== 'graphics_team' && <span className="text-destructive">*</span>}</Label>
              <Select value={editCampusId} onValueChange={setEditCampusId}>
                <SelectTrigger><SelectValue placeholder="No campus" /></SelectTrigger>
                <SelectContent>
                  {allCampuses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.campus_name} {c.status !== 'approved' && `(${c.status})`}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Use this to fix a campus the ambassador mistakenly selected at application time.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Session</Label>
              <Select value={editSessionId} onValueChange={setEditSessionId}>
                <SelectTrigger><SelectValue placeholder="No session" /></SelectTrigger>
                <SelectContent>
                  {allSessions.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              onClick={() => editTarget && editMutation.mutate({
                id: editTarget.id,
                campus_id: editCampusId || null,
                sub_role: editSubRole,
                session_id: editSessionId || null,
              })}
              disabled={editMutation.isPending || (editSubRole !== 'graphics_team' && !editCampusId)}
            >
              {editMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Save
            </Button>
          </DialogFooter>
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

const AmbassadorDetailDialog = ({ application, onOpenChange }: { application: any; onOpenChange: (open: boolean) => void }) => {
  const meta = SUB_ROLE_META[application?.sub_role];
  const Icon = meta?.icon || Star;

  const { data: breakdown } = useQuery({
    queryKey: ['admin-ambassador-activity-breakdown', application?.id],
    enabled: !!application,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ambassador_activity_breakdown', { _application_id: application.id });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tally } = useQuery({
    queryKey: ['admin-ambassador-vote-tally', application?.id],
    enabled: !!application,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ambassador_vote_tally', { _application_id: application.id });
      if (error) throw error;
      return data?.[0] || { up_votes: 0, down_votes: 0, total_votes: 0, accept_pct: null };
    },
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['admin-ambassador-activity-timeline', application?.id],
    enabled: !!application,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_activity_log')
        .select('*')
        .eq('application_id', application.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Dialog open={!!application} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={application?.profile?.avatar_url} />
              <AvatarFallback>{application?.profile?.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
            </Avatar>
            <div>
              <p>{application?.profile?.full_name}</p>
              <p className="text-xs font-normal text-muted-foreground">{application?.profile?.roll_id}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Icon className="h-4 w-4 text-primary" />
            {meta?.label}{application?.campus?.campus_name && ` · ${application.campus.campus_name}`}{application?.session?.label && ` · ${application.session.label}`}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total Points</p><p className="text-2xl font-heading font-bold text-primary">{application?.points}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Community Acceptance</p><p className="text-2xl font-heading font-bold">{tally?.accept_pct != null ? `${tally.accept_pct}%` : '—'}</p><p className="text-[10px] text-muted-foreground">{tally?.total_votes ?? 0} votes</p></CardContent></Card>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">Why they're ranked here</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ACTIVITY_META).map(([type, m]) => {
                const row = breakdown?.find((r: any) => r.activity_type === type);
                if (!row) return null;
                const Ic = m.icon;
                return (
                  <div key={type} className="border rounded-lg p-2.5 text-xs">
                    <p className="text-muted-foreground flex items-center gap-1.5"><Ic className="h-3.5 w-3.5" /> {m.label}</p>
                    <p className="font-bold text-sm mt-0.5">{row.cnt} <span className="font-normal text-muted-foreground">(+{row.total_points} pts)</span></p>
                  </div>
                );
              })}
              {(!breakdown || breakdown.length === 0) && <p className="text-xs text-muted-foreground col-span-2">No tracked activity yet.</p>}
            </div>
          </div>

          {application?.skills?.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Skills</p>
              <div className="flex flex-wrap gap-1">
                {application.skills.map((s: string) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold mb-2">Recent Activity</p>
            {timeline.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing logged yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {timeline.map((t: any) => {
                  const m = ACTIVITY_META[t.activity_type];
                  const Ic = m?.icon || Award;
                  return (
                    <div key={t.id} className="flex items-start justify-between gap-2 text-xs border-b pb-1.5 last:border-0">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <Ic className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="truncate">{t.note || m?.label || t.activity_type}</p>
                          <p className="text-muted-foreground">{format(new Date(t.created_at), 'dd MMM yyyy, h:mm a')}</p>
                        </div>
                      </div>
                      <span className="font-bold text-primary shrink-0">+{t.points}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const MEDAL_STYLES = [
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 ring-2 ring-amber-400', // gold
  'bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300 ring-2 ring-slate-400', // silver
  'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400 ring-2 ring-orange-400', // bronze
];

const ROWS_PER_PDF_PAGE = 10;

const RankingTab = () => {
  const [search, setSearch] = useState('');
  const [detailTarget, setDetailTarget] = useState<any | null>(null);

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['admin-ambassador-ranking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_applications')
        .select('*, profile:user_profiles(full_name, roll_id, avatar_url), campus:campus_onboard_requests(campus_name), session:ambassador_sessions(label)')
        .eq('status', 'approved')
        .order('points', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
  });

  const q = search.trim().toLowerCase();
  const filtered = !q ? applications : applications.filter((a: any) =>
    a.profile?.full_name?.toLowerCase().includes(q) || a.campus?.campus_name?.toLowerCase().includes(q)
  );

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = 210;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('OTS Campus Ambassador Leaderboard', pageWidth / 2, 18, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()} · ${applications.length} ambassadors · ${applications.reduce((s: number, a: any) => s + a.points, 0)} total points`, pageWidth / 2, 25, { align: 'center' });

    const drawTableHeader = (y: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setFillColor(235, 235, 235);
      doc.rect(15, y, 180, 8, 'F');
      doc.text('Rank', 18, y + 6);
      doc.text('Name', 35, y + 6);
      doc.text('Campus', 95, y + 6);
      doc.text('Role', 150, y + 6);
      doc.text('Points', 180, y + 6);
      return y + 10;
    };

    let y = drawTableHeader(35);
    doc.setFont('helvetica', 'normal');

    applications.forEach((a: any, idx: number) => {
      if (idx > 0 && idx % ROWS_PER_PDF_PAGE === 0) {
        doc.addPage();
        y = drawTableHeader(20);
      }
      doc.text(`#${idx + 1}`, 18, y + 5);
      doc.text((a.profile?.full_name || 'Unknown').substring(0, 28), 35, y + 5);
      doc.text((a.campus?.campus_name || '—').substring(0, 30), 95, y + 5);
      doc.text(SUB_ROLE_META[a.sub_role]?.label.replace(' Ambassador', '').substring(0, 16) || a.sub_role, 150, y + 5);
      doc.text(String(a.points), 180, y + 5);
      doc.line(15, y + 7, 195, y + 7);
      y += 10;
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
    }

    doc.save(`ots-ambassador-leaderboard-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('Leaderboard PDF downloaded');
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (applications.length === 0) return <p className="text-center py-12 text-muted-foreground">No approved ambassadors yet.</p>;

  const totalPoints = applications.reduce((sum: number, a: any) => sum + a.points, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Ambassadors</p><p className="text-2xl font-heading font-bold">{applications.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Points Earned</p><p className="text-2xl font-heading font-bold">{totalPoints}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg Points / Ambassador</p><p className="text-2xl font-heading font-bold">{Math.round(totalPoints / applications.length)}</p></CardContent></Card>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or campus..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Button variant="outline" onClick={downloadPDF}>
          <FileDown className="h-4 w-4 mr-1.5" /> Download PDF
        </Button>
      </div>

      <div className="space-y-2">
        {filtered.map((a: any) => {
          const idx = applications.indexOf(a);
          const meta = SUB_ROLE_META[a.sub_role];
          const Icon = meta?.icon || Star;
          return (
            <Card key={a.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setDetailTarget(a)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${idx < 3 ? MEDAL_STYLES[idx] : 'bg-muted text-muted-foreground'}`}>
                  {idx < 3 ? <Medal className="h-4 w-4" /> : idx + 1}
                </div>
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={a.profile?.avatar_url} />
                  <AvatarFallback>{a.profile?.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                    <p className="font-semibold text-sm truncate">{a.profile?.full_name || a.user_id.slice(0, 8)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{meta?.label}{a.campus?.campus_name && ` · ${a.campus.campus_name}`}{a.session?.label && ` · ${a.session.label}`}</p>
                  <AmbassadorActivityBreakdown applicationId={a.id} />
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl font-heading font-bold text-primary">{a.points}</p>
                  <p className="text-[10px] text-muted-foreground">points</p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <AddActivityButton application={a} />
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">No ambassadors match "{search}".</p>}
      </div>

      {detailTarget && <AmbassadorDetailDialog application={detailTarget} onOpenChange={(o) => !o && setDetailTarget(null)} />}
    </div>
  );
};

const AdminAmbassadors = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Ambassador Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Review applications, approve/reject, rank by points, correct a mistakenly-entered campus or role, and manage selectable sessions.</p>
      </div>
      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="ranking"><Trophy className="h-3.5 w-3.5 mr-1.5" /> Ranking</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="team-cards"><Users className="h-3.5 w-3.5 mr-1.5" /> Team Cards</TabsTrigger>
        </TabsList>
        <TabsContent value="applications" className="pt-4"><ApplicationsTab /></TabsContent>
        <TabsContent value="ranking" className="pt-4"><RankingTab /></TabsContent>
        <TabsContent value="sessions" className="pt-4"><SessionsTab /></TabsContent>
        <TabsContent value="team-cards" className="pt-4"><TeamCardsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAmbassadors;
