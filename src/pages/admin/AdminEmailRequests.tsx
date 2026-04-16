import { TableSkeleton } from '@/components/ui/loading-skeletons';
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
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Clock, AlertTriangle, Search, Mail, Shield, ShieldOff, Key, HardDrive, Trash2, Eye, Calendar, Copy } from 'lucide-react';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  failed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const statusIcons: Record<string, any> = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  failed: AlertTriangle,
  expired: Calendar,
};

const AdminEmailRequests = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [actionDialog, setActionDialog] = useState<{ id: string; action: string; email: string } | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [detailModal, setDetailModal] = useState<any>(null);

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

  const userIds = [...new Set(requests.map((r: any) => r.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ['email-req-profiles', userIds.join(',')],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('id, full_name, roll_id, avatar_url').in('id', userIds);
      return data || [];
    },
  });

  // Fetch auth emails for users
  const { data: userEmails = {} } = useQuery({
    queryKey: ['email-req-auth-emails', userIds.join(',')],
    enabled: userIds.length > 0,
    queryFn: async () => {
      // We can't get auth emails client-side, so we store a placeholder
      // The admin can see the personal email in the detail modal via the edge function
      return {} as Record<string, string>;
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
    onSuccess: async (data) => {
      const messages: Record<string, string> = {
        approved: `✅ Email ${data.email} created!`,
        rejected: '❌ Request rejected',
        blocked: '🔒 Email blocked',
        unblocked: '🔓 Email unblocked',
        'password-reset': `🔑 Password reset. New password: ${data.password}`,
        deleted: '🗑️ Email account deleted',
      };
      toast({ title: messages[data.status || data.action] || 'Action completed' });

      // Send notification to user
      const req = requests.find((r: any) => r.id === actionDialog?.id);
      if (req) {
        const { createNotificationWithEmail, NOTIFICATION_TYPES } = await import('@/lib/notifications');
        const status = data.status || data.action;
        const notifMap: Record<string, { type: string; title: string; message: string }> = {
          approved: { type: NOTIFICATION_TYPES.EMAIL_APPROVED, title: 'Institutional Email Approved ✅', message: `Your email ${data.email} has been created! Check your EduMail dashboard for credentials.` },
          rejected: { type: NOTIFICATION_TYPES.EMAIL_REJECTED, title: 'Email Request Rejected ❌', message: 'Your institutional email request was rejected. Please contact support for details.' },
          blocked: { type: NOTIFICATION_TYPES.EMAIL_BLOCKED, title: 'Email Account Blocked 🔒', message: `Your institutional email ${req.requested_email} has been temporarily blocked.` },
          unblocked: { type: NOTIFICATION_TYPES.EMAIL_UNBLOCKED, title: 'Email Account Unblocked 🔓', message: `Your institutional email ${req.requested_email} has been unblocked. You can now access it again.` },
        };
        if (notifMap[status]) {
          createNotificationWithEmail({
            userId: req.user_id,
            ...notifMap[status],
            link: '/dashboard/edumail',
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['institutional-email-requests'] });
      setActionDialog(null);
      setAdminNotes('');
      setDetailModal(null);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const checkUsageMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.functions.invoke('cpanel-email-provisioner', {
        body: { requestId, action: 'check-usage' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: '📊 Usage updated' });
      queryClient.invalidateQueries({ queryKey: ['institutional-email-requests'] });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
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
    expired: requests.filter((r: any) => r.status === 'expired').length,
    blocked: requests.filter((r: any) => r.is_blocked).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6" /> Institutional Email Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Manage email provisioning, blocking, passwords, and validity</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: counts.all, color: 'bg-muted' },
          { label: 'Pending', value: counts.pending, color: 'bg-yellow-100 dark:bg-yellow-900/20' },
          { label: 'Active', value: counts.approved, color: 'bg-green-100 dark:bg-green-900/20' },
          { label: 'Rejected', value: counts.rejected, color: 'bg-red-100 dark:bg-red-900/20' },
          { label: 'Expired', value: counts.expired, color: 'bg-gray-100 dark:bg-gray-900/20' },
          { label: 'Blocked', value: counts.blocked, color: 'bg-orange-100 dark:bg-orange-900/20' },
        ].map((s) => (
          <div key={s.label} className={`${s.color} rounded-lg p-3 text-center`}>
            <p className="text-xl font-bold">{s.value}</p>
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
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({counts.all})</SelectItem>
            <SelectItem value="pending">Pending ({counts.pending})</SelectItem>
            <SelectItem value="approved">Active ({counts.approved})</SelectItem>
            <SelectItem value="rejected">Rejected ({counts.rejected})</SelectItem>
            <SelectItem value="expired">Expired ({counts.expired})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Institutional Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Storage</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton rows={5} columns={6} />
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No requests found</TableCell></TableRow>
            ) : (
              filtered.map((r: any) => {
                const p = profileMap[r.user_id];
                const StatusIcon = statusIcons[r.status] || Clock;
                const validUntil = r.valid_until ? new Date(r.valid_until) : null;
                const daysRemaining = validUntil ? Math.max(0, Math.ceil((validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
                const usedMb = r.disk_usage_bytes ? (r.disk_usage_bytes / (1024 * 1024)).toFixed(1) : '0';

                return (
                  <TableRow key={r.id} className={r.is_blocked ? 'bg-destructive/5' : ''}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{p?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{p?.roll_id || '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-sm">{r.requested_email}</span>
                        {r.is_blocked && <Shield className="h-3.5 w-3.5 text-destructive" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[r.status]} gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {r.is_blocked ? 'Blocked' : r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {validUntil ? (
                        <div>
                          <span className={daysRemaining! <= 30 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                            {daysRemaining} days
                          </span>
                          <p className="text-xs text-muted-foreground">{validUntil.toLocaleDateString()}</p>
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{usedMb} MB</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end flex-wrap">
                        {r.status === 'pending' && (
                          <>
                            <Button size="sm" variant="default" onClick={() => setActionDialog({ id: r.id, action: 'approve', email: r.requested_email })}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setActionDialog({ id: r.id, action: 'reject', email: r.requested_email })}>
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {r.status === 'approved' && (
                          <>
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="View Details" onClick={() => setDetailModal(r)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" title={r.is_blocked ? 'Unblock' : 'Block'}
                              onClick={() => processMutation.mutate({ requestId: r.id, action: r.is_blocked ? 'unblock' : 'block', notes: '' })}>
                              {r.is_blocked ? <ShieldOff className="h-4 w-4 text-green-600" /> : <Shield className="h-4 w-4 text-destructive" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Reset Password"
                              onClick={() => processMutation.mutate({ requestId: r.id, action: 'reset-password', notes: '' })}>
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Check Usage"
                              onClick={() => checkUsageMutation.mutate(r.id)} disabled={checkUsageMutation.isPending}>
                              <HardDrive className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {(r.status === 'expired' || (r.status === 'approved' && r.is_blocked)) && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Delete Account"
                            onClick={() => setActionDialog({ id: r.id, action: 'delete', email: r.requested_email })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {r.status === 'failed' && (
                          <Button size="sm" variant="outline" onClick={() => {
                            supabase.from('institutional_email_requests').update({ status: 'pending', admin_notes: null }).eq('id', r.id)
                              .then(() => queryClient.invalidateQueries({ queryKey: ['institutional-email-requests'] }));
                          }}>Retry</Button>
                        )}
                      </div>
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
            <DialogTitle>
              {actionDialog?.action === 'approve' && '✅ Approve Email Request'}
              {actionDialog?.action === 'reject' && '❌ Reject Email Request'}
              {actionDialog?.action === 'delete' && '🗑️ Delete Email Account'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              {actionDialog?.action === 'approve' && `This will create the email account "${actionDialog?.email}" on the mail server.`}
              {actionDialog?.action === 'reject' && `This will reject the request for "${actionDialog?.email}".`}
              {actionDialog?.action === 'delete' && `This will permanently delete the email account "${actionDialog?.email}" from the mail server.`}
            </p>
            <div>
              <label className="text-sm font-medium">Admin Notes (optional)</label>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Notes..." />
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
              {processMutation.isPending ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={!!detailModal} onOpenChange={() => setDetailModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" /> Email Account Details
            </DialogTitle>
          </DialogHeader>
          {detailModal && (() => {
            const r = detailModal;
            const p = profileMap[r.user_id];
            const validUntil = r.valid_until ? new Date(r.valid_until) : null;
            const daysRemaining = validUntil ? Math.max(0, Math.ceil((validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
            const usedMb = r.disk_usage_bytes ? (r.disk_usage_bytes / (1024 * 1024)).toFixed(1) : '0';
            const quotaMb = r.email_quota_mb || 512;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Student:</span><p className="font-medium">{p?.full_name || 'Unknown'}</p></div>
                  <div><span className="text-muted-foreground">Roll ID:</span><p className="font-medium">{p?.roll_id || '—'}</p></div>
                </div>

                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Institutional Email</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-medium flex-1">{r.requested_email}</p>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(r.requested_email); toast({ title: 'Copied!' }); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {r.current_password && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Current Password</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-medium flex-1">{r.current_password}</p>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(r.current_password); toast({ title: 'Password copied!' }); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Validity</span>
                    <span className={daysRemaining <= 30 ? 'text-destructive font-medium' : ''}>{daysRemaining} days remaining</span>
                  </div>
                  <Progress value={validUntil ? Math.min(100, ((Date.now() - new Date(r.valid_from || r.approved_at).getTime()) / (validUntil.getTime() - new Date(r.valid_from || r.approved_at).getTime())) * 100) : 0} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{r.valid_from ? new Date(r.valid_from).toLocaleDateString() : '—'}</span>
                    <span>{validUntil?.toLocaleDateString() || '—'}</span>
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Storage Used</span>
                  <span>{usedMb} MB / {quotaMb} MB</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColors[r.status]}>{r.is_blocked ? 'Blocked' : r.status}</Badge></div>
                  <div><span className="text-muted-foreground">Created:</span> {new Date(r.created_at).toLocaleDateString()}</div>
                  {r.last_password_reset_at && <div className="col-span-2"><span className="text-muted-foreground">Last Password Reset:</span> {new Date(r.last_password_reset_at).toLocaleDateString()}</div>}
                  {r.admin_notes && <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> {r.admin_notes}</div>}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant={r.is_blocked ? 'default' : 'destructive'} className="flex-1"
                    onClick={() => processMutation.mutate({ requestId: r.id, action: r.is_blocked ? 'unblock' : 'block', notes: '' })}
                    disabled={processMutation.isPending}>
                    {r.is_blocked ? <><ShieldOff className="h-4 w-4 mr-1" /> Unblock</> : <><Shield className="h-4 w-4 mr-1" /> Block</>}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1"
                    onClick={() => processMutation.mutate({ requestId: r.id, action: 'reset-password', notes: '' })}
                    disabled={processMutation.isPending}>
                    <Key className="h-4 w-4 mr-1" /> Reset Password
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEmailRequests;
