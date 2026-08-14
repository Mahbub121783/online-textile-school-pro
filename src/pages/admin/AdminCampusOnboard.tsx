import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Loader2, Globe, MapPin, Users } from 'lucide-react';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const AdminCampusOnboard = () => {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: campuses = [], isLoading } = useQuery({
    queryKey: ['admin-campus-onboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('campus_onboard_requests').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke('campus-approve', { body: { id } });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-campus-onboard'] }); toast.success('Campus approved'); },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.functions.invoke('campus-reject', { body: { id, reason } });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campus-onboard'] });
      toast.success('Campus rejected');
      setRejectTarget(null); setRejectReason('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const provisionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('campus-provision-subdomain', { body: { id } });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-campus-onboard'] });
      toast.success(`Subdomain live: ${data?.subdomain}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Campus Onboarding</h1>
        <p className="text-sm text-muted-foreground mt-1">Review and approve campus partner requests. Subdomain provisioning is a separate, explicit step after approval — it cannot be undone automatically, so double-check the slug first.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : campuses.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No campus onboarding requests yet.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {campuses.map((c: any) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{c.campus_name}</CardTitle>
                  <Badge className={`${statusColors[c.status]} capitalize shrink-0`}>{c.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {c.area}</p>
                {c.student_count != null && <p className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-3.5 w-3.5" /> {c.student_count} students</p>}
                {c.facilities && <p className="text-foreground/80">{c.facilities}</p>}
                <div className="border-t pt-2 mt-2 space-y-0.5 text-xs text-muted-foreground">
                  <p>Contact: {c.contact_name} · {c.contact_email} {c.contact_phone && `· ${c.contact_phone}`}</p>
                  <p>Requested subdomain: <span className="font-mono">{c.subdomain_slug}.onlinetextileschool.com</span></p>
                  <p>Submitted {format(new Date(c.created_at), 'dd MMM yyyy')}</p>
                  {c.rejection_reason && <p className="text-destructive">Rejected: {c.rejection_reason}</p>}
                  {c.subdomain_error && <p className="text-destructive">Subdomain error: {c.subdomain_error}</p>}
                </div>

                {c.status === 'pending' && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1" onClick={() => approveMutation.mutate(c.id)} disabled={approveMutation.isPending}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => setRejectTarget(c.id)}>
                      <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
                    </Button>
                  </div>
                )}
                {c.status === 'approved' && !c.subdomain_provisioned && (
                  <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => provisionMutation.mutate(c.id)} disabled={provisionMutation.isPending}>
                    {provisionMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Globe className="h-3.5 w-3.5 mr-1.5" />}
                    Create Subdomain
                  </Button>
                )}
                {c.subdomain_provisioned && (
                  <a href={`https://${c.subdomain_slug}.onlinetextileschool.com`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary text-sm hover:underline pt-2">
                    <Globe className="h-3.5 w-3.5" /> {c.subdomain_slug}.onlinetextileschool.com (live)
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Campus Request</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget, reason: rejectReason })} disabled={rejectMutation.isPending}>
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCampusOnboard;
