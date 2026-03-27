import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, XCircle, UserPlus, Search, Eye, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface Application {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  expertise: string;
  experience_years: number | null;
  qualification: string | null;
  university: string | null;
  bio: string | null;
  linkedin_url: string | null;
  sample_video_url: string | null;
  motivation: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const ApprovalsTab = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['instructor-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructor_applications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Application[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (app: Application) => {
      // Update application status
      const { error: updateErr } = await supabase
        .from('instructor_applications')
        .update({ status: 'approved', reviewed_by: user?.id, reviewed_at: new Date().toISOString(), admin_notes: adminNotes || null })
        .eq('id', app.id);
      if (updateErr) throw updateErr;

      // Grant instructor role
      const { error: roleErr } = await supabase
        .from('user_roles')
        .insert({ user_id: app.user_id, role: 'instructor' });
      if (roleErr && !roleErr.message.includes('duplicate')) throw roleErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-applications'] });
      setSelectedApp(null);
      setAdminNotes('');
      toast({ title: 'Instructor Approved', description: 'The instructor role has been granted.' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (app: Application) => {
      const { error } = await supabase
        .from('instructor_applications')
        .update({ status: 'rejected', reviewed_by: user?.id, reviewed_at: new Date().toISOString(), admin_notes: adminNotes || null })
        .eq('id', app.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-applications'] });
      setSelectedApp(null);
      setAdminNotes('');
      toast({ title: 'Application Rejected', variant: 'destructive' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const pending = applications.filter(a => a.status === 'pending');
  const approved = applications.filter(a => a.status === 'approved');

  const filtered = applications.filter(a => {
    const matchSearch = !searchQuery ||
      a.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.expertise.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-warning/10 text-warning border-warning/30',
      approved: 'bg-success/10 text-success border-success/30',
      rejected: 'bg-destructive/10 text-destructive border-destructive/30',
    };
    return <Badge variant="outline" className={styles[status] || ''}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-secondary border-none">
          <CardContent className="p-5 flex items-center gap-3">
            <UserPlus className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold font-heading">{pending.length}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-secondary border-none">
          <CardContent className="p-5 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-success" />
            <div>
              <p className="text-2xl font-bold font-heading">{approved.length}</p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-secondary border-none">
          <CardContent className="p-5 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-accent" />
            <div>
              <p className="text-2xl font-bold font-heading">{applications.length}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, expertise..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="bg-secondary/50 border-none">
        <CardHeader><CardTitle className="font-heading text-lg">Instructor Applications</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm">No applications found.</p>
          ) : (
            <div className="rounded-lg overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Expertise</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{app.full_name}</p>
                          <p className="text-xs text-muted-foreground">{app.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{app.expertise}</TableCell>
                      <TableCell>{app.experience_years ? `${app.experience_years} yrs` : '—'}</TableCell>
                      <TableCell>{format(new Date(app.created_at), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{statusBadge(app.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedApp(app); setAdminNotes(app.admin_notes || ''); }}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedApp} onOpenChange={(open) => { if (!open) setSelectedApp(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Application Details</DialogTitle>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">Name</p><p className="font-medium">{selectedApp.full_name}</p></div>
                <div><p className="text-muted-foreground">Email</p><p className="font-medium">{selectedApp.email}</p></div>
                <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{selectedApp.phone || '—'}</p></div>
                <div><p className="text-muted-foreground">Expertise</p><p className="font-medium">{selectedApp.expertise}</p></div>
                <div><p className="text-muted-foreground">Experience</p><p className="font-medium">{selectedApp.experience_years ? `${selectedApp.experience_years} years` : '—'}</p></div>
                <div><p className="text-muted-foreground">Qualification</p><p className="font-medium">{selectedApp.qualification || '—'}</p></div>
                <div className="col-span-2"><p className="text-muted-foreground">University</p><p className="font-medium">{selectedApp.university || '—'}</p></div>
              </div>

              {selectedApp.bio && (
                <div><p className="text-sm text-muted-foreground mb-1">Bio</p><p className="text-sm bg-secondary/50 rounded-lg p-3">{selectedApp.bio}</p></div>
              )}
              {selectedApp.motivation && (
                <div><p className="text-sm text-muted-foreground mb-1">Motivation</p><p className="text-sm bg-secondary/50 rounded-lg p-3">{selectedApp.motivation}</p></div>
              )}

              <div className="flex gap-4 text-sm">
                {selectedApp.linkedin_url && (
                  <a href={selectedApp.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> LinkedIn
                  </a>
                )}
                {selectedApp.sample_video_url && (
                  <a href={selectedApp.sample_video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> Sample Video
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Status:</p>
                {statusBadge(selectedApp.status)}
                {selectedApp.reviewed_at && (
                  <span className="text-xs text-muted-foreground">• Reviewed {format(new Date(selectedApp.reviewed_at), 'MMM dd, yyyy')}</span>
                )}
              </div>

              {selectedApp.status === 'pending' && (
                <>
                  <div>
                    <p className="text-sm font-medium mb-1">Admin Notes (optional)</p>
                    <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} maxLength={1000} placeholder="Add notes about this application..." rows={3} />
                  </div>
                  <div className="flex gap-3">
                    <Button className="flex-1 bg-success hover:bg-success/90" onClick={() => approveMutation.mutate(selectedApp)} disabled={approveMutation.isPending}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => rejectMutation.mutate(selectedApp)} disabled={rejectMutation.isPending}>
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </>
              )}

              {selectedApp.admin_notes && selectedApp.status !== 'pending' && (
                <div><p className="text-sm text-muted-foreground mb-1">Admin Notes</p><p className="text-sm bg-secondary/50 rounded-lg p-3">{selectedApp.admin_notes}</p></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApprovalsTab;
