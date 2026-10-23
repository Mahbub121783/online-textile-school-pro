import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Droplet, ShieldCheck, Trash2, Loader2, Search, UserPlus } from 'lucide-react';
import BloodModerationPanel from '@/components/bloodbank/BloodModerationPanel';

const ModeratorsTab = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<any | null>(null);
  const [campusId, setCampusId] = useState('all');

  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 400); return () => clearTimeout(t); }, [q]);

  const { data: campuses = [] } = useQuery({
    queryKey: ['blood-bank-campuses'],
    queryFn: async () => {
      const { data } = await supabase.from('campus_onboard_requests').select('id, campus_name').eq('status', 'approved').order('campus_name');
      return data ?? [];
    },
  });

  const { data: moderators = [], isLoading } = useQuery({
    queryKey: ['blood-bank-moderators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blood_bank_moderators')
        .select('*, profile:user_profiles(full_name, roll_id, avatar_url), campus:campus_onboard_requests(campus_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['blood-mod-user-search', debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const term = debounced.replace(/[%,()]/g, '');
      const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name, roll_id, avatar_url, campus')
        .or(`full_name.ilike.%${term}%,roll_id.ilike.%${term}%,username.ilike.%${term}%`)
        .limit(8);
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('blood_bank_moderators').insert({
        user_id: picked.id, campus_id: campusId === 'all' ? null : campusId, assigned_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blood-bank-moderators'] });
      toast.success(`${picked.full_name} is now a blood bank moderator`);
      setPicked(null); setQ('');
    },
    onError: (e: any) => toast.error(e.message?.includes('duplicate') ? 'Already a moderator for that scope' : e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blood_bank_moderators').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['blood-bank-moderators'] }); toast.success('Moderator access removed'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4" /> Assign a moderator</p>
          <p className="text-xs text-muted-foreground">
            A campus moderator verifies donors, approves/rejects blood requests, edits donor records, confirms donations and exports
            donor lists — for their campus only. "All campuses" grants the same control network-wide.
          </p>
          {picked ? (
            <div className="flex items-center gap-2 border rounded-lg p-2">
              <Avatar className="h-8 w-8"><AvatarImage src={picked.avatar_url} /><AvatarFallback>{picked.full_name?.[0]}</AvatarFallback></Avatar>
              <span className="text-sm flex-1">{picked.full_name} <span className="text-xs text-muted-foreground">{picked.roll_id}</span></span>
              <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>Change</Button>
            </div>
          ) : (
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search user by name, roll ID or username..." value={q} onChange={(e) => setQ(e.target.value)} />
              {isFetching && <Loader2 className="h-4 w-4 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />}
              {debounced.length >= 2 && results.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-64 overflow-auto">
                  {results.map((u: any) => (
                    <button key={u.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 flex items-center gap-2" onClick={() => setPicked(u)}>
                      <Avatar className="h-6 w-6"><AvatarImage src={u.avatar_url} /><AvatarFallback>{u.full_name?.[0]}</AvatarFallback></Avatar>
                      <span className="flex-1 truncate">{u.full_name}</span>
                      <span className="text-xs text-muted-foreground">{u.roll_id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Scope</Label>
            <Select value={campusId} onValueChange={setCampusId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campuses (global moderator)</SelectItem>
                {campuses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.campus_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => add.mutate()} disabled={!picked || add.isPending}>
            {add.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Grant moderator access
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Current moderators ({moderators.length})</p>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : moderators.length === 0 ? (
          <p className="text-sm text-muted-foreground">No moderators yet — admins can moderate everything in the meantime.</p>
        ) : moderators.map((m: any) => (
          <Card key={m.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <Avatar className="h-9 w-9"><AvatarImage src={m.profile?.avatar_url} /><AvatarFallback>{m.profile?.full_name?.[0]}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{m.profile?.full_name}</p>
                <p className="text-xs text-muted-foreground">{m.profile?.roll_id} · since {format(new Date(m.created_at), 'dd MMM yyyy')}</p>
              </div>
              <Badge variant={m.campus_id ? 'outline' : 'default'}>{m.campus_id ? m.campus?.campus_name || 'Campus' : 'All campuses'}</Badge>
              <Button size="sm" variant="outline" className="text-destructive px-2" onClick={() => { if (confirm('Remove this moderator?')) remove.mutate(m.id); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const AdminBloodBank = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Droplet className="h-6 w-6 text-red-500 fill-red-500" /> Blood Bank</h1>
      <p className="text-sm text-muted-foreground mt-1">Verify donors, approve blood requests (approval instantly alerts the nearest compatible donors), and assign campus moderators.</p>
    </div>
    <Tabs defaultValue="moderation">
      <TabsList>
        <TabsTrigger value="moderation">Moderation</TabsTrigger>
        <TabsTrigger value="moderators"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Moderators</TabsTrigger>
      </TabsList>
      <TabsContent value="moderation" className="pt-4"><BloodModerationPanel scopeLabel="All campuses (admin)" /></TabsContent>
      <TabsContent value="moderators" className="pt-4"><ModeratorsTab /></TabsContent>
    </Tabs>
  </div>
);

export default AdminBloodBank;
