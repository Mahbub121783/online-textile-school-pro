import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { CheckCircle, XCircle, Loader2, Pencil, Trash2, Download, Users, Droplet, Search, Sparkles, MapPin, Phone, Ban } from 'lucide-react';
import {
  BLOOD_GROUPS, URGENCY_META, REQUEST_STATUS_META, DONOR_STATUS_META, formatDistance, toCsv, downloadText, nextEligibleDate,
} from '@/lib/bloodBank';

const useApprovedCampuses = () => useQuery({
  queryKey: ['blood-bank-campuses'],
  queryFn: async () => {
    const { data } = await supabase.from('campus_onboard_requests').select('id, campus_name').eq('status', 'approved').order('campus_name');
    return data ?? [];
  },
});

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------
const RankedDonorsPreview = ({ requestId }: { requestId: string }) => {
  const { data = [], isLoading } = useQuery({
    queryKey: ['blood-rank-preview', requestId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('blood_rank_donors', { _request_id: requestId });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (!data.length) return <p className="text-xs text-muted-foreground">No eligible compatible donor in the network right now.</p>;
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{data.length} eligible donor(s). These will be alerted in this order on approval:</p>
      {data.slice(0, 10).map((d: any, i: number) => (
        <div key={d.donor_id} className="flex items-center gap-2 text-xs">
          <span className="w-5 text-muted-foreground">#{i + 1}</span>
          <Badge variant="outline" className="w-10 justify-center">{d.blood_group}</Badge>
          <span className="flex-1 truncate">{d.full_name}{d.campus_name && <span className="text-muted-foreground"> · {d.campus_name}</span>}</span>
          <span className="text-muted-foreground w-24 text-right">{formatDistance(d.distance_km)}</span>
          <div className="w-16 h-1.5 bg-muted rounded overflow-hidden" title={`score ${Number(d.match_score).toFixed(2)}`}>
            <div className="h-full bg-primary" style={{ width: `${Math.round(Number(d.match_score) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const RequestResponses = ({ requestId }: { requestId: string }) => {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['blood-request-matches', requestId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('blood_request_matches', { _request_id: requestId });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 20000,
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['blood-request-matches', requestId] });
    queryClient.invalidateQueries({ queryKey: ['blood-mod-requests'] });
  };
  const donated = useMutation({
    mutationFn: async (responseId: string) => {
      const { error } = await supabase.rpc('blood_mark_donated', { _response_id: responseId });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Donation confirmed'); },
    onError: (e: any) => toast.error(e.message),
  });
  const noShow = useMutation({
    mutationFn: async (responseId: string) => {
      const { error } = await supabase.from('blood_request_responses').update({ status: 'no_show' }).eq('id', responseId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Marked as no-show'); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (!data.length) return <p className="text-xs text-muted-foreground">No donor contacted yet.</p>;
  return (
    <div className="space-y-1.5">
      {data.map((m: any) => (
        <div key={m.response_id} className="flex items-center gap-2 text-xs border-b pb-1.5 last:border-0">
          <Badge variant="outline" className="w-10 justify-center">{m.blood_group}</Badge>
          <span className="flex-1 truncate">{m.full_name}</span>
          <span className="text-muted-foreground hidden sm:inline">{formatDistance(m.distance_km)}</span>
          {m.phone && <a href={`tel:${m.phone}`} className="text-primary flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</a>}
          <Badge variant="secondary" className="capitalize text-[10px]">{m.status.replace('_', ' ')}</Badge>
          {m.status === 'accepted' && (
            <>
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => donated.mutate(m.response_id)} disabled={donated.isPending}>Donated</Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => noShow.mutate(m.response_id)} disabled={noShow.isPending}>No-show</Button>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

const RequestsTab = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'pending' | 'approved' | 'closed' | 'all'>('pending');
  const [expanded, setExpanded] = useState<Record<string, 'preview' | 'responses' | undefined>>({});
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [reason, setReason] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['blood-mod-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blood_requests')
        .select('*, requester:user_profiles(full_name, roll_id), campus:campus_onboard_requests(campus_name)')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 20000,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status, rejection_reason }: { id: string; status: string; rejection_reason?: string }) => {
      const { error } = await supabase.from('blood_requests').update({ status, ...(rejection_reason !== undefined ? { rejection_reason } : {}) }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['blood-mod-requests'] });
      toast.success(v.status === 'approved' ? 'Approved — nearby donors are being alerted' : `Request ${v.status}`);
      setRejectTarget(null); setReason('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blood_requests').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['blood-mod-requests'] }); toast.success('Request deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = requests.filter((r: any) =>
    filter === 'all' ? true
    : filter === 'closed' ? ['fulfilled', 'cancelled', 'expired', 'rejected'].includes(r.status)
    : r.status === filter
  );
  const count = (s: string) => requests.filter((r: any) => r.status === s).length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {(['pending', 'approved', 'closed', 'all'] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} className="capitalize">
            {f === 'approved' ? 'Live' : f}
            {f === 'pending' && count('pending') > 0 && ` (${count('pending')})`}
            {f === 'approved' && count('approved') > 0 && ` (${count('approved')})`}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-10 text-muted-foreground text-sm">Nothing here.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: any) => (
            <Card key={r.id} className={r.urgency === 'critical' && r.status === 'pending' ? 'border-red-400' : ''}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-red-600 text-white flex items-center justify-center font-bold shrink-0">{r.blood_group}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{r.patient_name} · {r.units} bag(s)</p>
                      <Badge className={URGENCY_META[r.urgency]?.className}>{URGENCY_META[r.urgency]?.label}</Badge>
                      <Badge className={REQUEST_STATUS_META[r.status]?.className}>{REQUEST_STATUS_META[r.status]?.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{r.hospital}{r.district && `, ${r.district}`}{r.campus?.campus_name && ` · ${r.campus.campus_name}`}</p>
                    <p className="text-xs text-muted-foreground">
                      By {r.requester?.full_name || 'Unknown'} · <a className="text-primary" href={`tel:${r.contact_phone}`}>{r.contact_phone}</a> · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      {r.needed_by && ` · needed by ${format(new Date(r.needed_by), 'dd MMM, h:mm a')}`}
                    </p>
                    {r.status === 'approved' && <p className="text-xs">Fulfilled {r.units_fulfilled}/{r.units} · alert round {r.escalation_round}</p>}
                    {r.note && <p className="text-xs italic">“{r.note}”</p>}
                    {r.rejection_reason && <p className="text-xs text-destructive">Reason: {r.rejection_reason}</p>}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {r.status === 'pending' && (
                    <>
                      <Button size="sm" onClick={() => setStatus.mutate({ id: r.id, status: 'approved' })} disabled={setStatus.isPending}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Approve &amp; alert donors
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setRejectTarget(r)}><XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject</Button>
                    </>
                  )}
                  {(r.status === 'pending' || r.status === 'approved') && (
                    <Button size="sm" variant="outline" onClick={() => setExpanded((p) => ({ ...p, [r.id]: p[r.id] === 'preview' ? undefined : 'preview' }))}>
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Smart matches
                    </Button>
                  )}
                  {r.status !== 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => setExpanded((p) => ({ ...p, [r.id]: p[r.id] === 'responses' ? undefined : 'responses' }))}>
                      <Users className="h-3.5 w-3.5 mr-1.5" /> Donor responses
                    </Button>
                  )}
                  {r.status === 'approved' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r.id, status: 'fulfilled' })}>Mark fulfilled</Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r.id, status: 'cancelled' })}>Cancel</Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" className="text-destructive px-2" onClick={() => { if (confirm('Delete this request permanently?')) del.mutate(r.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {expanded[r.id] === 'preview' && <div className="border rounded-lg p-3"><RankedDonorsPreview requestId={r.id} /></div>}
                {expanded[r.id] === 'responses' && <div className="border rounded-lg p-3"><RequestResponses requestId={r.id} /></div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject blood request</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason shown to the requester (e.g. duplicate request, could not verify)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectTarget && setStatus.mutate({ id: rejectTarget.id, status: 'rejected', rejection_reason: reason || undefined })} disabled={setStatus.isPending}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Donors
// ---------------------------------------------------------------------------
const DonorsTab = () => {
  const queryClient = useQueryClient();
  const { data: campuses = [] } = useApprovedCampuses();
  const [status, setStatus] = useState('pending');
  const [group, setGroup] = useState('all');
  const [search, setSearch] = useState('');
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [edit, setEdit] = useState<any>({});

  const { data: donors = [], isLoading } = useQuery({
    queryKey: ['blood-mod-donors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blood_donors')
        .select('*, profile:user_profiles(full_name, roll_id, avatar_url), campus:campus_onboard_requests(campus_name)')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from('blood_donors').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blood-mod-donors'] });
      toast.success('Donor updated');
      setRejectTarget(null); setReason(''); setEditTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blood_donors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['blood-mod-donors'] }); toast.success('Donor removed'); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return donors.filter((d: any) =>
      (status === 'all' || d.status === status)
      && (group === 'all' || d.blood_group === group)
      && (!q || d.profile?.full_name?.toLowerCase().includes(q) || d.phone?.includes(q) || d.profile?.roll_id?.toLowerCase().includes(q) || d.campus?.campus_name?.toLowerCase().includes(q))
    );
  }, [donors, status, group, search]);

  const exportCsv = () => {
    downloadText(`ots-blood-donors-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(filtered.map((d: any) => ({
      name: d.profile?.full_name, roll_id: d.profile?.roll_id, blood_group: d.blood_group, phone: d.phone,
      campus: d.campus?.campus_name || '', district: d.district || '', status: d.status, available: d.is_available ? 'yes' : 'no',
      last_donation: d.last_donation_at || '', total_donations: d.total_donations,
      response_rate: d.times_notified ? `${Math.round((d.times_accepted / d.times_notified) * 100)}%` : '',
      has_location: d.latitude != null ? 'yes' : 'no', joined: d.created_at?.slice(0, 10),
    }))));
  };

  const count = (s: string) => donors.filter((d: any) => d.status === s).length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        {['pending', 'approved', 'rejected', 'suspended', 'all'].map((s) => (
          <Button key={s} size="sm" variant={status === s ? 'default' : 'outline'} onClick={() => setStatus(s)} className="capitalize">
            {s}{s !== 'all' && count(s) > 0 && ` (${count(s)})`}
          </Button>
        ))}
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {BLOOD_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Name, phone, roll, campus..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download className="h-3.5 w-3.5 mr-1.5" /> CSV</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-10 text-muted-foreground text-sm">No donors match.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((d: any) => {
            const eligible = nextEligibleDate(d.last_donation_at);
            return (
              <Card key={d.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={d.profile?.avatar_url} />
                      <AvatarFallback>{d.profile?.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{d.profile?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground truncate">{d.profile?.roll_id} · <a href={`tel:${d.phone}`} className="text-primary">{d.phone}</a></p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm shrink-0">{d.blood_group}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <Badge className={DONOR_STATUS_META[d.status]?.className}>{DONOR_STATUS_META[d.status]?.label}</Badge>
                    {!d.is_available && <Badge variant="secondary">Unavailable</Badge>}
                    {eligible && <Badge variant="secondary">Resting until {format(eligible, 'dd MMM')}</Badge>}
                    {d.latitude == null && <Badge variant="outline">No location</Badge>}
                    {d.campus?.campus_name && <Badge variant="outline">{d.campus.campus_name}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {d.total_donations} donation(s) · accepted {d.times_accepted}/{d.times_notified} alerts
                    {d.last_donation_at && ` · last donated ${format(new Date(d.last_donation_at), 'dd MMM yyyy')}`}
                  </p>
                  {d.rejection_reason && <p className="text-xs text-destructive">{d.rejection_reason}</p>}
                  <div className="flex gap-2 flex-wrap pt-1">
                    {d.status !== 'approved' && (
                      <Button size="sm" onClick={() => update.mutate({ id: d.id, patch: { status: 'approved', rejection_reason: null } })} disabled={update.isPending}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Approve
                      </Button>
                    )}
                    {d.status === 'pending' && (
                      <Button size="sm" variant="destructive" onClick={() => setRejectTarget(d)}><XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject</Button>
                    )}
                    {d.status === 'approved' && (
                      <Button size="sm" variant="outline" onClick={() => update.mutate({ id: d.id, patch: { status: 'suspended' } })}><Ban className="h-3.5 w-3.5 mr-1.5" /> Suspend</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditTarget(d);
                      setEdit({ blood_group: d.blood_group, phone: d.phone, campus_id: d.campus_id || 'none', district: d.district || '', last_donation_at: d.last_donation_at || '', is_available: d.is_available });
                    }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive px-2" onClick={() => { if (confirm('Remove this donor from the network?')) del.mutate(d.id); }}>
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
          <DialogHeader><DialogTitle>Reject donor — {rejectTarget?.profile?.full_name}</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason shown to the donor (e.g. could not verify blood group)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectTarget && update.mutate({ id: rejectTarget.id, patch: { status: 'rejected', rejection_reason: reason || null } })} disabled={update.isPending}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit donor — {editTarget?.profile?.full_name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Blood group</Label>
              <Select value={edit.blood_group} onValueChange={(v) => setEdit((p: any) => ({ ...p, blood_group: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BLOOD_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={edit.phone || ''} onChange={(e) => setEdit((p: any) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Campus</Label>
              <Select value={edit.campus_id} onValueChange={(v) => setEdit((p: any) => ({ ...p, campus_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No campus</SelectItem>
                  {campuses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.campus_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>District</Label>
              <Input value={edit.district || ''} onChange={(e) => setEdit((p: any) => ({ ...p, district: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Last donation</Label>
              <Input type="date" value={edit.last_donation_at || ''} onChange={(e) => setEdit((p: any) => ({ ...p, last_donation_at: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <Switch checked={!!edit.is_available} onCheckedChange={(v) => setEdit((p: any) => ({ ...p, is_available: v }))} />
              <span className="text-sm">Available to donate</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              onClick={() => editTarget && update.mutate({
                id: editTarget.id,
                patch: {
                  blood_group: edit.blood_group, phone: edit.phone, campus_id: edit.campus_id === 'none' ? null : edit.campus_id,
                  district: edit.district || null, last_donation_at: edit.last_donation_at || null, is_available: edit.is_available,
                },
              })}
              disabled={update.isPending || !edit.phone}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
const OverviewTab = () => {
  const { data: stats } = useQuery({
    queryKey: ['blood-bank-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('blood_bank_stats');
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 60000,
  });
  const byGroup: Record<string, number> = stats?.donors_by_group || {};
  const max = Math.max(1, ...Object.values(byGroup));
  const tiles = [
    { label: 'Verified donors', value: stats?.donors_approved },
    { label: 'Ready to donate now', value: stats?.donors_ready },
    { label: 'Live requests', value: stats?.open_requests },
    { label: 'Donations confirmed', value: stats?.donations_total },
    { label: 'Requests fulfilled', value: stats?.requests_fulfilled },
    { label: 'Avg. time to accept', value: stats?.avg_accept_minutes != null ? `${stats.avg_accept_minutes} min` : '—' },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {tiles.map((t) => (
          <Card key={t.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="text-2xl font-heading font-bold">{t.value ?? '—'}</p>
          </CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="p-4 space-y-2">
        <p className="text-sm font-semibold">Verified donors by blood group (network-wide)</p>
        {BLOOD_GROUPS.map((g) => (
          <div key={g} className="flex items-center gap-2 text-xs">
            <span className="w-8 font-semibold">{g}</span>
            <div className="flex-1 h-3 bg-muted rounded overflow-hidden">
              <div className="h-full bg-red-500" style={{ width: `${((byGroup[g] || 0) / max) * 100}%` }} />
            </div>
            <span className="w-8 text-right text-muted-foreground">{byGroup[g] || 0}</span>
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
};

const BloodModerationPanel = ({ scopeLabel }: { scopeLabel?: string }) => (
  <div className="space-y-3">
    {scopeLabel && (
      <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Droplet className="h-3.5 w-3.5 text-red-500" /> Moderating: {scopeLabel}</p>
    )}
    <Tabs defaultValue="requests">
      <TabsList>
        <TabsTrigger value="requests">Requests</TabsTrigger>
        <TabsTrigger value="donors">Donors</TabsTrigger>
        <TabsTrigger value="overview">Overview</TabsTrigger>
      </TabsList>
      <TabsContent value="requests" className="pt-3"><RequestsTab /></TabsContent>
      <TabsContent value="donors" className="pt-3"><DonorsTab /></TabsContent>
      <TabsContent value="overview" className="pt-3"><OverviewTab /></TabsContent>
    </Tabs>
  </div>
);

export default BloodModerationPanel;
