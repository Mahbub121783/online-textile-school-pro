import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { CheckCircle, XCircle, Clock, AlertTriangle, Search, Mail } from 'lucide-react';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  failed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

const statusIcons: Record<string, any> = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  failed: AlertTriangle,
};

const AdminEmailRequests = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [actionDialog, setActionDialog] = useState<{ id: string; action: 'approve' | 'reject'; email: string } | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['institutional-email-requests', filter],
    queryFn: async () => {
      let q = supabase.from('institutional_email_requests').select('*').order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch user profiles for display
  const userIds = [...new Set(requests.map((r: any) => r.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ['email-req-profiles', userIds.join(',')],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('id, full_name, roll_id, avatar_url').in('id', userIds);
      return data || [];
    },
  });

  const profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));

  const processMutation = useMutation({
    mutationFn: async ({ requestId, action, notes }: { requestId: string; action: string; notes: string }) => {
      const { data, error } = await supabase.functions.invoke('cpanel-email-provisioner', {
        body: { requestId, action, adminNotes: notes },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({ title: data.status === 'approved' ? '✅ Email Created!' : '❌ Request Rejected', description: data.email ? `${data.email} provisioned successfully` : 'Request has been rejected' });
      queryClient.invalidateQueries({ queryKey: ['institutional-email-requests'] });
      setActionDialog(null);
      setAdminNotes('');
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const filtered = requests.filter((r: any) => {
    if (!search) return true;
    const p = profileMap[r.user_id];
    const searchLower = search.toLowerCase();
    return r.requested_email.toLowerCase().includes(searchLower) || p?.full_name?.toLowerCase().includes(searchLower) || p?.roll_id?.toLowerCase().includes(searchLower);
  });

  const counts = {
    all: requests.length,
    pending: requests.filter((r: any) => r.status === 'pending').length,
    approved: requests.filter((r: any) => r.status === 'approved').length,
    rejected: requests.filter((r: any) => r.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6" /> Institutional Email Requests
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Manage student & instructor email provisioning via cPanel</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: counts.all, color: 'bg-muted' },
          { label: 'Pending', value: counts.pending, color: 'bg-yellow-100 dark:bg-yellow-900/20' },
          { label: 'Approved', value: counts.approved, color: 'bg-green-100 dark:bg-green-900/20' },
          { label: 'Rejected', value: counts.rejected, color: 'bg-red-100 dark:bg-red-900/20' },
        ].map((s) => (
          <div key={s.label} className={`${s.color} rounded-lg p-4 text-center`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or roll ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({counts.all})</SelectItem>
            <SelectItem value="pending">Pending ({counts.pending})</SelectItem>
            <SelectItem value="approved">Approved ({counts.approved})</SelectItem>
            <SelectItem value="rejected">Rejected ({counts.rejected})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Requested Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No requests found</TableCell></TableRow>
            ) : (
              filtered.map((r: any) => {
                const p = profileMap[r.user_id];
                const StatusIcon = statusIcons[r.status] || Clock;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{p?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{p?.roll_id || '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{r.requested_email}</TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[r.status]} gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{r.admin_notes || '—'}</TableCell>
                    <TableCell className="text-right">
                      {r.status === 'pending' && (
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="default" onClick={() => setActionDialog({ id: r.id, action: 'approve', email: r.requested_email })}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setActionDialog({ id: r.id, action: 'reject', email: r.requested_email })}>
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                      {r.status === 'failed' && (
                        <Button size="sm" variant="outline" onClick={() => {
                          // Reset to pending so admin can retry
                          supabase.from('institutional_email_requests').update({ status: 'pending', admin_notes: null }).eq('id', r.id)
                            .then(() => queryClient.invalidateQueries({ queryKey: ['institutional-email-requests'] }));
                        }}>
                          Retry
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setAdminNotes(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog?.action === 'approve' ? '✅ Approve Email Request' : '❌ Reject Email Request'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              {actionDialog?.action === 'approve'
                ? `This will create the email account "${actionDialog?.email}" on the mail server.`
                : `This will reject the request for "${actionDialog?.email}".`}
            </p>
            <div>
              <label className="text-sm font-medium">Admin Notes (optional)</label>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder={actionDialog?.action === 'reject' ? 'Reason for rejection...' : 'Any notes...'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setAdminNotes(''); }}>Cancel</Button>
            <Button
              variant={actionDialog?.action === 'approve' ? 'default' : 'destructive'}
              disabled={processMutation.isPending}
              onClick={() => {
                if (actionDialog) {
                  processMutation.mutate({ requestId: actionDialog.id, action: actionDialog.action, notes: adminNotes });
                }
              }}
            >
              {processMutation.isPending ? 'Processing...' : actionDialog?.action === 'approve' ? 'Create Email Account' : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEmailRequests;
