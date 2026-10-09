import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Crown, Star, Palette } from 'lucide-react';

const SUB_ROLES = [
  { value: 'head_of_campus', label: 'Head of Campus Ambassador', icon: Crown },
  { value: 'ambassador', label: 'Ambassador', icon: Star },
  { value: 'graphics_team', label: 'Graphics Team', icon: Palette },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const AmbassadorApplicationCard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [subRole, setSubRole] = useState('');
  const [campusId, setCampusId] = useState('');
  const [sessionId, setSessionId] = useState('');

  const { data: application, isLoading } = useQuery({
    queryKey: ['my-ambassador-application', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('ambassador_applications').select('*, campus:campus_onboard_requests(campus_name), session:ambassador_sessions(label)').eq('user_id', user!.id).maybeSingle();
      return data;
    },
  });

  const { data: campuses = [] } = useQuery({
    queryKey: ['approved-campuses-for-ambassador'],
    queryFn: async () => {
      const { data } = await supabase.from('campus_onboard_requests').select('id, campus_name').eq('status', 'approved').order('campus_name');
      return data ?? [];
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['active-ambassador-sessions'],
    queryFn: async () => {
      const { data } = await supabase.from('ambassador_sessions').select('id, label').eq('is_active', true).order('sort_order');
      return data ?? [];
    },
  });

  const needsCampus = subRole && subRole !== 'graphics_team';

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: user!.id,
        sub_role: subRole,
        campus_id: needsCampus ? campusId || null : null,
        session_id: sessionId || null,
        status: 'pending' as const,
      };
      if (application) {
        const { error } = await supabase.from('ambassador_applications').update(payload).eq('id', application.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ambassador_applications').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-ambassador-application', user?.id] });
      toast.success('Ambassador application submitted — awaiting admin approval.');
      setSubRole(''); setCampusId(''); setSessionId('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

  if (application && application.status !== 'rejected') {
    return (
      <div className="border rounded-xl p-4 space-y-2 bg-muted/30">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Ambassador Application</p>
          <Badge className={`${STATUS_COLORS[application.status]} capitalize`}>{application.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {SUB_ROLES.find((r) => r.value === application.sub_role)?.label}
          {application.campus?.campus_name && ` · ${application.campus.campus_name}`}
          {application.session?.label && ` · ${application.session.label}`}
        </p>
        {application.status === 'approved' && (
          <p className="text-xs text-muted-foreground">Points: <span className="font-bold text-foreground">{application.points}</span> — check the Ambassador Hub in your dashboard menu.</p>
        )}
        {application.status === 'pending' && (
          <p className="text-xs text-muted-foreground">Your application is awaiting admin review.</p>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-xl p-4 space-y-3">
      <p className="font-semibold text-sm">Ambassador Application</p>
      {application?.status === 'rejected' && (
        <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
          Previous application rejected{application.rejection_reason ? `: ${application.rejection_reason}` : '.'} You can resubmit below.
        </div>
      )}
      <div className="space-y-2">
        <Label>Ambassador Type</Label>
        <Select value={subRole} onValueChange={setSubRole}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {SUB_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {needsCampus && (
        <div className="space-y-2">
          <Label>Campus</Label>
          <Select value={campusId} onValueChange={setCampusId}>
            <SelectTrigger><SelectValue placeholder="Select your campus" /></SelectTrigger>
            <SelectContent>
              {campuses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.campus_name}</SelectItem>)}
            </SelectContent>
          </Select>
          {campuses.length === 0 && <p className="text-xs text-muted-foreground">No onboarded campuses yet — ask your campus to onboard first.</p>}
        </div>
      )}
      <div className="space-y-2">
        <Label>Session</Label>
        <Select value={sessionId} onValueChange={setSessionId}>
          <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
          <SelectContent>
            {sessions.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button
        size="sm"
        onClick={() => submitMutation.mutate()}
        disabled={submitMutation.isPending || !subRole || !sessionId || (needsCampus && !campusId)}
      >
        {submitMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
        Submit Application
      </Button>
    </div>
  );
};

export default AmbassadorApplicationCard;
