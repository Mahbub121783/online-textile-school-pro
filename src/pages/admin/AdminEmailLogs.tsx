import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, CheckCircle, XCircle, Clock, Search, RefreshCw } from 'lucide-react';
import { sendTemplateEmail } from '@/lib/emailSender';
import { useToast } from '@/hooks/use-toast';

const AdminEmailLogs = () => {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['email-logs', statusFilter],
    queryFn: async () => {
      let q = supabase.from('email_logs').select('*').order('created_at', { ascending: false }).limit(100);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data } = await q;
      return data || [];
    },
  });

  const filteredLogs = logs?.filter(log =>
    !searchQuery || log.recipient?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.template_key?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const stats = {
    total: logs?.length || 0,
    sent: logs?.filter(l => l.status === 'sent').length || 0,
    failed: logs?.filter(l => l.status === 'failed').length || 0,
    pending: logs?.filter(l => l.status === 'pending').length || 0,
  };

  const handleResend = async (log: any) => {
    try {
      await sendTemplateEmail(log.template_key, log.recipient, undefined, { resend_of: log.id });
      toast({ title: 'Email resent successfully' });
      refetch();
    } catch {
      toast({ title: 'Failed to resend', variant: 'destructive' });
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case 'failed': return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default: return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Mail className="h-6 w-6 text-primary" /> Email Logs
        </h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Emails</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-600">Sent</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600">{stats.sent}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-destructive">Failed</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{stats.failed}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.pending}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by email, subject, template..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading email logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No email logs found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.recipient}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{log.subject}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{log.template_key}</Badge></TableCell>
                    <TableCell>{statusBadge(log.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      {log.status === 'failed' && (
                        <Button size="sm" variant="ghost" onClick={() => handleResend(log)}>Resend</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminEmailLogs;
