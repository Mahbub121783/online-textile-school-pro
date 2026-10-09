import { useState } from 'react';
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
import { CheckCircle, XCircle, Loader2, Crown, Star, Palette, Plus, Trash2, Minus } from 'lucide-react';
import { format } from 'date-fns';

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

const ApplicationsTab = () => {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pointsTarget, setPointsTarget] = useState<any | null>(null);
  const [pointsDelta, setPointsDelta] = useState('');
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

  const filtered = applications.filter((a: any) => filter === 'all' || a.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} className="capitalize">{f}</Button>
        ))}
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
                  {a.rejection_reason && <p className="text-xs text-destructive">Rejected: {a.rejection_reason}</p>}

                  <div className="flex gap-2 pt-2">
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
        </TabsList>
        <TabsContent value="applications" className="pt-4"><ApplicationsTab /></TabsContent>
        <TabsContent value="sessions" className="pt-4"><SessionsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAmbassadors;
