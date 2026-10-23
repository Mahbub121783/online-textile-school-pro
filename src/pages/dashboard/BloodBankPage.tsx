import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Droplet, MapPin, Navigation, Loader2, Phone, Heart, Clock, Users, Plus, LocateFixed, CheckCircle, XCircle, Map as MapIcon, ShieldCheck, Search,
} from 'lucide-react';
import BloodModerationPanel from '@/components/bloodbank/BloodModerationPanel';
import {
  BLOOD_GROUPS, COMPATIBLE_DONORS, URGENCY_META, REQUEST_STATUS_META, DONOR_STATUS_META, DONATION_GAP_DAYS,
  getCurrentPosition, locationPermissionGranted, formatDistance, directionsUrl, mapEmbedUrl, nextEligibleDate, searchPlaces,
  type PlaceResult,
} from '@/lib/bloodBank';

type LatLng = { lat: number; lng: number };

function kmBetween(a: LatLng, b: LatLng) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const useApprovedCampuses = () => useQuery({
  queryKey: ['blood-bank-campuses'],
  queryFn: async () => {
    const { data } = await supabase.from('campus_onboard_requests').select('id, campus_name').eq('status', 'approved').order('campus_name');
    return data ?? [];
  },
});

// ---------------------------------------------------------------------------
// Hospital / place search (OpenStreetMap)
// ---------------------------------------------------------------------------
const PlaceSearch = ({ onPick }: { onPick: (p: PlaceResult) => void }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 3) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try { setResults(await searchPlaces(q.trim())); setOpen(true); } catch { setResults([]); }
      setLoading(false);
    }, 600);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-8" placeholder="Search hospital / place on map..." value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => results.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} />
      {loading && <Loader2 className="h-4 w-4 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-56 overflow-auto">
          {results.map((r, i) => (
            <button key={i} type="button" className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60" onClick={() => { onPick(r); setQ(r.label.split(',')[0]); setOpen(false); }}>
              <MapPin className="h-3 w-3 inline mr-1 text-red-500" />{r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Nearby (Uber-style feed)
// ---------------------------------------------------------------------------
const NearbyTab = ({ donor, position, locating, onLocate, focusRequestId, onGoToDonor }: {
  donor: any; position: LatLng | null; locating: boolean; onLocate: () => void; focusRequestId: string | null; onGoToDonor: () => void;
}) => {
  const queryClient = useQueryClient();
  const [radius, setRadius] = useState('50');
  const [mapFor, setMapFor] = useState<string | null>(null);
  const [contact, setContact] = useState<any | null>(null);
  const focusRef = useRef<HTMLDivElement | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['blood-nearby', position?.lat?.toFixed(3), position?.lng?.toFixed(3), radius, donor?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('blood_nearby_requests', {
        _lat: position?.lat ?? null, _lng: position?.lng ?? null, _radius_km: Number(radius),
      });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (focusRequestId && focusRef.current) focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusRequestId, requests.length]);

  const respond = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { data, error } = await supabase.rpc('blood_respond', { _request_id: id, _accept: accept });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['blood-nearby'] });
      if (data?.status === 'accepted') setContact(data);
      else toast.success('Declined — thanks for letting us know');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const donorReady = donor?.status === 'approved' && donor?.is_available && !nextEligibleDate(donor?.last_donation_at);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Button size="sm" variant={position ? 'outline' : 'default'} onClick={onLocate} disabled={locating}>
          {locating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5 mr-1.5" />}
          {position ? 'Refresh my location' : 'Use my live location'}
        </Button>
        <Select value={radius} onValueChange={setRadius}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['5', '10', '25', '50', '100', '500'].map((r) => <SelectItem key={r} value={r}>Within {r} km</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {position ? 'Sorted by urgency, then nearest to you.' : 'Share your location to see the nearest requests first.'}
        </span>
      </div>

      {!donor && (
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <Heart className="h-5 w-5 text-red-500" />
            <p className="text-sm flex-1">Register as a donor to respond to requests and get alerted when someone near you needs blood.</p>
            <Button size="sm" onClick={onGoToDonor}>Become a donor</Button>
          </CardContent>
        </Card>
      )}
      {donor && donor.status !== 'approved' && (
        <p className="text-xs text-amber-700 dark:text-amber-400">Your donor profile is {DONOR_STATUS_META[donor.status]?.label.toLowerCase()} — you can respond once a moderator verifies it.</p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : requests.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
          <Droplet className="h-8 w-8 mx-auto mb-2 text-red-300" />
          No open blood requests {position ? `within ${radius} km` : ''} right now.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r: any) => {
            const focused = r.id === focusRequestId;
            const accepted = r.my_response === 'accepted' || r.my_response === 'donated';
            return (
              <div key={r.id} ref={focused ? focusRef : undefined}>
                <Card className={`${focused ? 'ring-2 ring-red-500' : ''} ${r.urgency === 'critical' ? 'border-red-300' : ''}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-14 rounded-full bg-red-600 text-white flex flex-col items-center justify-center shrink-0 shadow">
                        <span className="font-bold leading-none">{r.blood_group}</span>
                        <span className="text-[9px] opacity-80 mt-0.5">{r.units} bag{r.units > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={URGENCY_META[r.urgency]?.className}>{URGENCY_META[r.urgency]?.label}</Badge>
                          <Badge variant="outline" className="gap-1"><Navigation className="h-3 w-3" />{formatDistance(r.distance_km)}</Badge>
                          {r.can_donate
                            ? <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Your blood matches</Badge>
                            : donor && <Badge variant="secondary">Not compatible with {donor.blood_group}</Badge>}
                        </div>
                        <p className="font-semibold text-sm mt-1 flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-red-500 shrink-0" /><span className="truncate">{r.hospital}</span></p>
                        <p className="text-xs text-muted-foreground">
                          For {r.patient_name}{r.district && ` · ${r.district}`}{r.campus_name && ` · ${r.campus_name}`} · posted {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </p>
                        {r.needed_by && <p className="text-xs flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3" /> Needed {formatDistanceToNow(new Date(r.needed_by), { addSuffix: true })} ({format(new Date(r.needed_by), 'dd MMM, h:mm a')})</p>}
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Users className="h-3 w-3" /> {Number(r.accepted_count)}/{r.units} donor(s) confirmed</p>
                        {r.note && <p className="text-xs italic mt-1">“{r.note}”</p>}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {accepted ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle className="h-3 w-3 mr-1" /> You accepted this</Badge>
                      ) : r.can_donate && (
                        <>
                          <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => respond.mutate({ id: r.id, accept: true })} disabled={respond.isPending || !donorReady}>
                            <Heart className="h-3.5 w-3.5 mr-1.5" /> I can donate
                          </Button>
                          {r.my_response === 'notified' && (
                            <Button size="sm" variant="outline" onClick={() => respond.mutate({ id: r.id, accept: false })} disabled={respond.isPending}>
                              <XCircle className="h-3.5 w-3.5 mr-1.5" /> Can't this time
                            </Button>
                          )}
                        </>
                      )}
                      {r.latitude != null && (
                        <>
                          <Button size="sm" variant="outline" asChild>
                            <a href={directionsUrl(r.latitude, r.longitude)} target="_blank" rel="noreferrer"><Navigation className="h-3.5 w-3.5 mr-1.5" /> Directions</a>
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setMapFor(mapFor === r.id ? null : r.id)}>
                            <MapIcon className="h-3.5 w-3.5 mr-1.5" /> {mapFor === r.id ? 'Hide map' : 'Map'}
                          </Button>
                        </>
                      )}
                    </div>
                    {r.can_donate && !accepted && donor && !donorReady && (
                      <p className="text-[11px] text-muted-foreground">
                        {nextEligibleDate(donor.last_donation_at)
                          ? `You can donate again from ${format(nextEligibleDate(donor.last_donation_at)!, 'dd MMM yyyy')}.`
                          : !donor.is_available ? 'Turn your availability on in "My Donor Profile" to respond.' : 'Your profile needs moderator verification first.'}
                      </p>
                    )}
                    {mapFor === r.id && r.latitude != null && (
                      <iframe title="Request location" className="w-full h-56 rounded-lg border" loading="lazy" src={mapEmbedUrl(r.latitude, r.longitude)} />
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!contact} onOpenChange={(o) => !o && setContact(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Heart className="h-5 w-5 text-red-500" /> Thank you — you're a lifesaver!</DialogTitle></DialogHeader>
          {contact && (
            <div className="space-y-2 text-sm">
              <p>The requester has been notified with your name and number. Please contact them now:</p>
              <div className="border rounded-lg p-3 space-y-1">
                <p><strong>Patient:</strong> {contact.patient_name} ({contact.units} bag(s))</p>
                <p><strong>Hospital:</strong> {contact.hospital}</p>
                {contact.needed_by && <p><strong>Needed by:</strong> {format(new Date(contact.needed_by), 'dd MMM yyyy, h:mm a')}</p>}
                {contact.note && <p><strong>Note:</strong> {contact.note}</p>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button asChild className="bg-red-600 hover:bg-red-700"><a href={`tel:${contact.contact_phone}`}><Phone className="h-4 w-4 mr-1.5" /> Call {contact.contact_phone}</a></Button>
                {contact.latitude != null && (
                  <Button asChild variant="outline"><a href={directionsUrl(contact.latitude, contact.longitude)} target="_blank" rel="noreferrer"><Navigation className="h-4 w-4 mr-1.5" /> Directions</a></Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ---------------------------------------------------------------------------
// My donor profile
// ---------------------------------------------------------------------------
const DonorTab = ({ donor, position, onLocate, locating }: { donor: any; position: LatLng | null; onLocate: () => void; locating: boolean }) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: campuses = [] } = useApprovedCampuses();
  const p = profile as any;

  const [form, setForm] = useState(() => ({
    blood_group: donor?.blood_group || ((BLOOD_GROUPS as readonly string[]).includes(p?.blood_group) ? p.blood_group : ''),
    phone: donor?.phone || p?.phone || '',
    campus_id: donor?.campus_id || p?.onboarded_campus_id || 'none',
    district: donor?.district || p?.district || '',
    last_donation_at: donor?.last_donation_at || '',
    is_available: donor?.is_available ?? true,
  }));

  useEffect(() => {
    if (!donor) return;
    setForm({
      blood_group: donor.blood_group, phone: donor.phone, campus_id: donor.campus_id || 'none',
      district: donor.district || '', last_donation_at: donor.last_donation_at || '', is_available: donor.is_available,
    });
  }, [donor?.id, donor?.updated_at]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        blood_group: form.blood_group, phone: form.phone.trim(), campus_id: form.campus_id === 'none' ? null : form.campus_id,
        district: form.district.trim() || null, last_donation_at: form.last_donation_at || null, is_available: form.is_available,
      };
      if (position && (!donor || donor.latitude == null)) { payload.latitude = position.lat; payload.longitude = position.lng; }
      const { error } = donor
        ? await supabase.from('blood_donors').update(payload).eq('id', donor.id)
        : await supabase.from('blood_donors').insert({ ...payload, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-blood-donor'] });
      toast.success(donor ? 'Donor profile updated' : 'Registered! A moderator will verify your profile shortly.');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const leave = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('blood_donors').delete().eq('id', donor.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['my-blood-donor'] }); toast.success('You have left the donor network'); },
    onError: (e: any) => toast.error(e.message),
  });

  const eligible = nextEligibleDate(donor?.last_donation_at);
  const responseRate = donor?.times_notified ? Math.round((donor.times_accepted / donor.times_notified) * 100) : null;

  return (
    <div className="space-y-4 max-w-2xl">
      {donor && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="h-14 w-14 rounded-full bg-red-600 text-white flex items-center justify-center text-lg font-bold">{donor.blood_group}</div>
              <div className="flex-1">
                <Badge className={DONOR_STATUS_META[donor.status]?.className}>{DONOR_STATUS_META[donor.status]?.label}</Badge>
                <p className="text-sm mt-1">
                  {eligible ? <>Resting — eligible again on <strong>{format(eligible, 'dd MMM yyyy')}</strong></>
                    : donor.is_available ? 'Ready to donate — you will be alerted for nearby compatible requests.'
                    : 'Availability is off — you will not receive alerts.'}
                </p>
                {donor.rejection_reason && <p className="text-xs text-destructive mt-1">{donor.rejection_reason}</p>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="border rounded-lg p-2"><p className="text-xl font-bold">{donor.total_donations}</p><p className="text-[10px] text-muted-foreground">Lives helped</p></div>
              <div className="border rounded-lg p-2"><p className="text-xl font-bold">{donor.times_accepted}</p><p className="text-[10px] text-muted-foreground">Requests accepted</p></div>
              <div className="border rounded-lg p-2"><p className="text-xl font-bold">{responseRate != null ? `${responseRate}%` : '—'}</p><p className="text-[10px] text-muted-foreground">Response rate</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="font-semibold flex items-center gap-2"><Heart className="h-4 w-4 text-red-500" /> {donor ? 'My donor profile' : 'Join the OTS blood donor network'}</p>
          {!donor && (
            <p className="text-xs text-muted-foreground">
              Your phone number is never shown publicly — a requester only receives it after you accept their request.
              A campus moderator verifies every donor before they receive alerts.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Blood group *</Label>
              <Select value={form.blood_group} onValueChange={(v) => setForm((f) => ({ ...f, blood_group: v }))}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{BLOOD_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="01XXXXXXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label>Campus</Label>
              <Select value={form.campus_id} onValueChange={(v) => setForm((f) => ({ ...f, campus_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not linked to a campus</SelectItem>
                  {campuses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.campus_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>District</Label>
              <Input value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} placeholder="e.g. Dhaka" />
            </div>
            <div className="space-y-1.5">
              <Label>Last donation date</Label>
              <Input type="date" value={form.last_donation_at} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setForm((f) => ({ ...f, last_donation_at: e.target.value }))} />
              <p className="text-[10px] text-muted-foreground">Leave empty if never. You'll be rested for {DONATION_GAP_DAYS} days after each donation.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Location (for nearest-first matching)</Label>
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={onLocate} disabled={locating}>
                {locating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5 mr-1.5" />}
                {donor?.latitude != null || position ? 'Update my location' : 'Share my location'}
              </Button>
              <p className="text-[10px] text-muted-foreground">
                {donor?.location_updated_at ? `Saved ${formatDistanceToNow(new Date(donor.location_updated_at), { addSuffix: true })} — refreshes automatically when you open this page.`
                  : position ? 'Location captured — it will be saved with your profile.' : 'Without location we fall back to your campus/district.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_available} onCheckedChange={(v) => setForm((f) => ({ ...f, is_available: v }))} />
            <span className="text-sm">I'm available to donate</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.blood_group || form.phone.trim().length < 6} className="bg-red-600 hover:bg-red-700">
              {save.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {donor ? 'Save changes' : 'Register as donor'}
            </Button>
            {donor && (
              <Button variant="ghost" className="text-destructive" onClick={() => { if (confirm('Leave the blood donor network?')) leave.mutate(); }}>Leave network</Button>
            )}
          </div>
          {donor?.status === 'approved' && (
            <p className="text-[11px] text-muted-foreground">Changing your blood group or campus sends your profile back for verification.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Requests: post + track my requests
// ---------------------------------------------------------------------------
const MyRequestMatches = ({ requestId }: { requestId: string }) => {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['blood-request-matches', requestId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('blood_request_matches', { _request_id: requestId });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });
  const donated = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('blood_mark_donated', { _response_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blood-request-matches', requestId] });
      queryClient.invalidateQueries({ queryKey: ['my-blood-requests'] });
      toast.success('Donation confirmed — thank you!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  const accepted = data.filter((m: any) => m.status === 'accepted' || m.status === 'donated');
  const waiting = data.filter((m: any) => m.status === 'notified').length;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{data.length} donor(s) alerted · {waiting} yet to respond · {accepted.length} confirmed</p>
      {accepted.map((m: any) => (
        <div key={m.response_id} className="flex items-center gap-2 text-sm border rounded-lg p-2">
          <Badge variant="outline">{m.blood_group}</Badge>
          <span className="flex-1 truncate">{m.full_name} <span className="text-xs text-muted-foreground">· {formatDistance(m.distance_km)}</span></span>
          {m.phone && <a href={`tel:${m.phone}`} className="text-primary text-xs flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</a>}
          {m.status === 'accepted'
            ? <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => donated.mutate(m.response_id)} disabled={donated.isPending}>Mark donated</Button>
            : <Badge className="bg-emerald-600 hover:bg-emerald-600">Donated</Badge>}
        </div>
      ))}
      {!accepted.length && <p className="text-xs">Waiting for a donor to accept — more donors are alerted automatically if nobody responds.</p>}
    </div>
  );
};

const NewRequestDialog = ({ open, onOpenChange, stats, position }: { open: boolean; onOpenChange: (o: boolean) => void; stats: any; position: LatLng | null }) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: campuses = [] } = useApprovedCampuses();
  const p = profile as any;
  const empty = () => ({
    patient_name: '', blood_group: '', units: '1', hospital: '', district: p?.district || '', campus_id: p?.onboarded_campus_id || 'none',
    contact_phone: p?.phone || '', needed_by: '', urgency: 'urgent', note: '', latitude: null as number | null, longitude: null as number | null,
  });
  const [form, setForm] = useState(empty);
  const [locating, setLocating] = useState(false);

  useEffect(() => { if (open) setForm(empty()); }, [open]);

  const compatibleSupply = useMemo(() => {
    if (!form.blood_group || !stats?.donors_by_group) return null;
    return (COMPATIBLE_DONORS[form.blood_group] || []).reduce((s, g) => s + (stats.donors_by_group[g] || 0), 0);
  }, [form.blood_group, stats]);

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('blood_requests').insert({
        requester_id: user!.id, patient_name: form.patient_name.trim(), blood_group: form.blood_group, units: Number(form.units),
        hospital: form.hospital.trim(), district: form.district.trim() || null, campus_id: form.campus_id === 'none' ? null : form.campus_id,
        contact_phone: form.contact_phone.trim(), needed_by: form.needed_by ? new Date(form.needed_by).toISOString() : null,
        urgency: form.urgency, note: form.note.trim() || null, latitude: form.latitude, longitude: form.longitude,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-blood-requests'] });
      toast.success('Request submitted — a moderator will review it and nearby donors will be alerted instantly on approval.');
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const useHere = async () => {
    setLocating(true);
    try {
      const pos = position || await getCurrentPosition();
      setForm((f) => ({ ...f, latitude: pos.lat, longitude: pos.lng }));
      toast.success('Using your current location as the hospital location');
    } catch (e: any) { toast.error(e.message); }
    setLocating(false);
  };

  const valid = form.patient_name.trim() && form.blood_group && form.hospital.trim() && form.contact_phone.trim().length >= 6;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Droplet className="h-5 w-5 text-red-500" /> Request blood</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Urgency *</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['critical', 'urgent', 'normal'] as const).map((u) => (
                <Button key={u} type="button" size="sm" variant={form.urgency === u ? 'default' : 'outline'} className={form.urgency === u ? URGENCY_META[u].className : ''} onClick={() => setForm((f) => ({ ...f, urgency: u }))}>
                  {URGENCY_META[u].label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Blood group *</Label>
            <Select value={form.blood_group} onValueChange={(v) => setForm((f) => ({ ...f, blood_group: v }))}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{BLOOD_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Bags needed *</Label>
            <Select value={form.units} onValueChange={(v) => setForm((f) => ({ ...f, units: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {compatibleSupply != null && (
            <p className="col-span-2 text-xs text-muted-foreground -mt-1">
              Can receive from {COMPATIBLE_DONORS[form.blood_group].join(', ')} · <strong>{compatibleSupply}</strong> verified compatible donor(s) in the network.
            </p>
          )}
          <div className="space-y-1.5 col-span-2">
            <Label>Patient name *</Label>
            <Input value={form.patient_name} onChange={(e) => setForm((f) => ({ ...f, patient_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Hospital / location *</Label>
            <PlaceSearch onPick={(pl) => setForm((f) => ({
              ...f, hospital: f.hospital || pl.label.split(',')[0], latitude: pl.lat, longitude: pl.lng, district: f.district || pl.district || '',
            }))} />
            <Input value={form.hospital} onChange={(e) => setForm((f) => ({ ...f, hospital: e.target.value }))} placeholder="Hospital name, ward/bed (shown to donors)" />
            <div className="flex items-center gap-2 text-xs">
              {form.latitude != null
                ? <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><MapPin className="h-3 w-3" /> Pinned on map — nearest donors will be alerted first</span>
                : <span className="text-muted-foreground">Not pinned yet — pick a search result or</span>}
              <Button type="button" size="sm" variant="link" className="h-auto p-0 text-xs" onClick={useHere} disabled={locating}>
                {locating ? 'locating...' : "I'm at the hospital now"}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>District</Label>
            <Input value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact phone *</Label>
            <Input value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} placeholder="Shared only with donors who accept" />
          </div>
          <div className="space-y-1.5">
            <Label>Needed by</Label>
            <Input type="datetime-local" value={form.needed_by} onChange={(e) => setForm((f) => ({ ...f, needed_by: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Campus</Label>
            <Select value={form.campus_id} onValueChange={(v) => setForm((f) => ({ ...f, campus_id: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No campus</SelectItem>
                {campuses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.campus_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Note for donors</Label>
            <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="e.g. Thalassemia patient, ask for Dr. X at the blood bank counter" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={() => submit.mutate()} disabled={!valid || submit.isPending}>
            {submit.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const RequestsTab = ({ stats, position }: { stats: any; position: LatLng | null }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['my-blood-requests', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('blood_requests').select('*').eq('requester_id', user!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 20000,
  });

  const close = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'cancelled' | 'fulfilled' }) => {
      const { error } = await supabase.from('blood_requests').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['my-blood-requests'] }); toast.success('Request closed'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <Button onClick={() => setOpen(true)} className="bg-red-600 hover:bg-red-700"><Plus className="h-4 w-4 mr-1.5" /> New blood request</Button>
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">You haven't requested blood yet.</p>
      ) : requests.map((r: any) => (
        <Card key={r.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-full bg-red-600 text-white flex items-center justify-center font-bold shrink-0">{r.blood_group}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{r.patient_name} · {r.units} bag(s)</p>
                  <Badge className={REQUEST_STATUS_META[r.status]?.className}>{REQUEST_STATUS_META[r.status]?.label}</Badge>
                  <Badge className={URGENCY_META[r.urgency]?.className}>{URGENCY_META[r.urgency]?.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.hospital} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p>
                {r.status === 'approved' && (
                  <div className="mt-1.5">
                    <div className="h-1.5 bg-muted rounded overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${(r.units_fulfilled / r.units) * 100}%` }} /></div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{r.units_fulfilled}/{r.units} bag(s) donated · alert round {r.escalation_round}</p>
                  </div>
                )}
                {r.rejection_reason && <p className="text-xs text-destructive">{r.rejection_reason}</p>}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {r.status !== 'pending' && r.status !== 'rejected' && (
                <Button size="sm" variant="outline" onClick={() => setExpanded(expanded === r.id ? null : r.id)}><Users className="h-3.5 w-3.5 mr-1.5" /> Donors</Button>
              )}
              {r.status === 'approved' && <Button size="sm" variant="outline" onClick={() => close.mutate({ id: r.id, status: 'fulfilled' })}><CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Got enough blood</Button>}
              {(r.status === 'approved' || r.status === 'pending') && <Button size="sm" variant="ghost" onClick={() => { if (confirm('Cancel this request?')) close.mutate({ id: r.id, status: 'cancelled' }); }}>Cancel</Button>}
            </div>
            {expanded === r.id && <div className="border rounded-lg p-3"><MyRequestMatches requestId={r.id} /></div>}
          </CardContent>
        </Card>
      ))}
      <NewRequestDialog open={open} onOpenChange={setOpen} stats={stats} position={position} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const BloodBankPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'nearby';
  const focusRequestId = params.get('request');
  const [position, setPosition] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);

  const { data: donor } = useQuery({
    queryKey: ['my-blood-donor', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('blood_donors').select('*').eq('user_id', user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: scope = [] } = useQuery({
    queryKey: ['blood-moderator-scope', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('blood_my_moderator_scope');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['blood-bank-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('blood_bank_stats');
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 60000,
  });

  // Keep a donor's saved location fresh like a ride app does -- but only
  // write when they've actually moved or it's gone stale, not on every open.
  const syncDonorLocation = async (pos: LatLng) => {
    if (!donor) return;
    const moved = donor.latitude == null || kmBetween(pos, { lat: donor.latitude, lng: donor.longitude }) > 0.3;
    const stale = !donor.location_updated_at || Date.now() - new Date(donor.location_updated_at).getTime() > 6 * 3600 * 1000;
    if (!moved && !stale) return;
    const { error } = await supabase.from('blood_donors').update({ latitude: pos.lat, longitude: pos.lng }).eq('id', donor.id);
    if (!error) queryClient.invalidateQueries({ queryKey: ['my-blood-donor'] });
  };

  const locate = async (silent = false) => {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setPosition(pos);
      await syncDonorLocation(pos);
      if (!silent) toast.success('Location updated');
    } catch (e: any) {
      if (!silent) toast.error(e.message);
    }
    setLocating(false);
  };

  useEffect(() => {
    locationPermissionGranted().then((granted) => { if (granted) locate(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donor?.id]);

  useEffect(() => {
    if (!position && donor?.latitude != null) setPosition({ lat: donor.latitude, lng: donor.longitude });
  }, [donor?.latitude, donor?.longitude]);

  const setTab = (t: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', t);
    if (t !== 'nearby') next.delete('request');
    setParams(next, { replace: true });
  };

  const isModerator = scope.length > 0;
  const scopeLabel = scope.some((s: any) => s.is_global) ? 'All campuses' : scope.map((s: any) => s.campus_name).filter(Boolean).join(', ');

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Droplet className="h-6 w-6 text-red-500 fill-red-500" /> OTS Blood Bank</h1>
          <p className="text-sm text-muted-foreground mt-1">Find and help the nearest patients in need — or get compatible donors near you alerted in minutes.</p>
        </div>
        <div className="flex gap-2 text-center">
          <div className="border rounded-lg px-3 py-1.5"><p className="text-lg font-bold leading-tight">{stats?.donors_ready ?? '—'}</p><p className="text-[10px] text-muted-foreground">Donors ready</p></div>
          <div className="border rounded-lg px-3 py-1.5"><p className="text-lg font-bold leading-tight">{stats?.open_requests ?? '—'}</p><p className="text-[10px] text-muted-foreground">Live requests</p></div>
          <div className="border rounded-lg px-3 py-1.5"><p className="text-lg font-bold leading-tight">{stats?.donations_total ?? '—'}</p><p className="text-[10px] text-muted-foreground">Lives helped</p></div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="nearby"><Navigation className="h-3.5 w-3.5 mr-1.5" /> Near me</TabsTrigger>
          <TabsTrigger value="requests"><Plus className="h-3.5 w-3.5 mr-1.5" /> Request blood</TabsTrigger>
          <TabsTrigger value="donor"><Heart className="h-3.5 w-3.5 mr-1.5" /> {donor ? 'My donor profile' : 'Become a donor'}</TabsTrigger>
          {isModerator && <TabsTrigger value="moderate"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Moderate</TabsTrigger>}
        </TabsList>
        <TabsContent value="nearby" className="pt-4">
          <NearbyTab donor={donor} position={position} locating={locating} onLocate={() => locate()} focusRequestId={focusRequestId} onGoToDonor={() => setTab('donor')} />
        </TabsContent>
        <TabsContent value="requests" className="pt-4"><RequestsTab stats={stats} position={position} /></TabsContent>
        <TabsContent value="donor" className="pt-4"><DonorTab donor={donor} position={position} onLocate={() => locate()} locating={locating} /></TabsContent>
        {isModerator && <TabsContent value="moderate" className="pt-4"><BloodModerationPanel scopeLabel={scopeLabel} /></TabsContent>}
      </Tabs>
    </div>
  );
};

export default BloodBankPage;
