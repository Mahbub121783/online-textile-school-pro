import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText, Trash2, Check, X, Eye, UserPlus, DollarSign,
  BarChart3, Clock, CheckCircle, XCircle, AlertTriangle, Search
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTIONS = ['draft', 'submitted', 'under_review', 'revision_requested', 'approved', 'rejected'];
const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  revision_requested: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const AdminResearchPapers = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<any>(null);
  const [assignReviewerOpen, setAssignReviewerOpen] = useState(false);
  const [reviewerId, setReviewerId] = useState('');

  const { data: papers = [], isLoading } = useQuery({
    queryKey: ['admin-research-papers', filter],
    queryFn: async () => {
      let q = supabase
        .from('research_papers')
        .select('*, user_profiles:submitted_by(full_name), reviewer:reviewer_id(full_name)')
        .order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: instructors = [] } = useQuery({
    queryKey: ['all-instructors-for-review'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, user_profiles:user_id(full_name)')
        .in('role', ['instructor', 'admin', 'super_admin']);
      return data ?? [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from('research_papers').update(updates).eq('id', selectedPaper.id);
      if (error) throw error;

      // Notify author on status change
      if (updates.status && selectedPaper.submitted_by) {
        await supabase.from('notifications').insert({
          user_id: selectedPaper.submitted_by,
          type: 'research',
          title: `Paper Status: ${updates.status.replace('_', ' ')}`,
          message: `Your paper "${selectedPaper.title}" status changed to ${updates.status.replace('_', ' ')}.`,
          link: '/dashboard/my-research',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-research-papers'] });
      setManageOpen(false);
      toast.success('Paper updated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('research_papers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-research-papers'] });
      toast.success('Paper deleted');
    },
  });

  const assignReviewerMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('research_papers').update({
        reviewer_id: reviewerId,
        status: 'under_review',
      }).eq('id', selectedPaper.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-research-papers'] });
      setAssignReviewerOpen(false);
      toast.success('Reviewer assigned');
    },
  });

  const openManage = (paper: any) => {
    setSelectedPaper(paper);
    setManageOpen(true);
  };

  const openAssignReviewer = (paper: any) => {
    setSelectedPaper(paper);
    setReviewerId(paper.reviewer_id || '');
    setAssignReviewerOpen(true);
  };

  const filtered = papers.filter((p: any) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: papers.length,
    submitted: papers.filter((p: any) => p.status === 'submitted').length,
    underReview: papers.filter((p: any) => p.status === 'under_review').length,
    approved: papers.filter((p: any) => p.status === 'approved').length,
    rejected: papers.filter((p: any) => p.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Research Papers</h1>
        <p className="text-sm text-muted-foreground">Manage submissions, reviews, and publications</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: FileText, color: 'text-foreground' },
          { label: 'Submitted', value: stats.submitted, icon: Clock, color: 'text-blue-600' },
          { label: 'Under Review', value: stats.underReview, icon: AlertTriangle, color: 'text-amber-600' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-green-600' },
          { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search papers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-1">
          {['all', ...STATUS_OPTIONS].map(f => (
            <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm"
              onClick={() => setFilter(f)} className="text-xs">
              {f === 'all' ? 'All' : f.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewer</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Stats</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 animate-pulse text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted" />No papers found.
                </TableCell></TableRow>
              ) : (
                filtered.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm max-w-[180px] truncate">{p.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.user_profiles?.full_name || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{p.category || '—'}</Badge></TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${statusColors[p.status] || ''}`}>
                        {p.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.reviewer?.full_name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {p.access_type === 'free' ? 'Free' : p.access_type === 'paid' ? `৳${p.price}` : 'Enrolled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.view_count}v / {p.download_count}d
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openManage(p)} title="Manage">
                          <BarChart3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAssignReviewer(p)} title="Assign Reviewer">
                          <UserPlus className="h-3.5 w-3.5" />
                        </Button>
                        {p.status === 'submitted' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600"
                            onClick={() => { setSelectedPaper(p); updateMutation.mutate({ status: 'approved', published_date: new Date().toISOString().split('T')[0] }); }}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {p.file_url && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <a href={p.file_url} target="_blank" rel="noopener noreferrer"><Eye className="h-3.5 w-3.5" /></a>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => deleteMutation.mutate(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Manage Dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Manage: {selectedPaper?.title}</DialogTitle></DialogHeader>
          {selectedPaper && (
            <div className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select defaultValue={selectedPaper.status}
                  onValueChange={v => setSelectedPaper((p: any) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Access Type</Label>
                <Select defaultValue={selectedPaper.access_type}
                  onValueChange={v => setSelectedPaper((p: any) => ({ ...p, access_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free (Open Access)</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="enrolled_only">Enrolled Students Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedPaper.access_type === 'paid' && (
                <div>
                  <Label>Price (৳)</Label>
                  <Input type="number" defaultValue={selectedPaper.price || 0}
                    onChange={e => setSelectedPaper((p: any) => ({ ...p, price: parseFloat(e.target.value) || 0 }))} />
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Volume</Label><Input defaultValue={selectedPaper.volume || ''}
                  onChange={e => setSelectedPaper((p: any) => ({ ...p, volume: e.target.value }))} /></div>
                <div><Label>Issue</Label><Input defaultValue={selectedPaper.issue || ''}
                  onChange={e => setSelectedPaper((p: any) => ({ ...p, issue: e.target.value }))} /></div>
                <div><Label>Pages</Label><Input defaultValue={selectedPaper.page_range || ''}
                  onChange={e => setSelectedPaper((p: any) => ({ ...p, page_range: e.target.value }))} /></div>
              </div>
              <div>
                <Label>DOI</Label>
                <Input defaultValue={selectedPaper.doi || ''}
                  onChange={e => setSelectedPaper((p: any) => ({ ...p, doi: e.target.value }))}
                  placeholder="10.xxxx/xxxxx" />
              </div>
              <div>
                <Label>Admin Feedback</Label>
                <Textarea defaultValue={selectedPaper.reviewer_feedback || ''}
                  onChange={e => setSelectedPaper((p: any) => ({ ...p, reviewer_feedback: e.target.value }))}
                  rows={3} placeholder="Feedback for the author..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageOpen(false)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate({
              status: selectedPaper.status,
              access_type: selectedPaper.access_type,
              price: selectedPaper.price,
              volume: selectedPaper.volume,
              issue: selectedPaper.issue,
              page_range: selectedPaper.page_range,
              doi: selectedPaper.doi,
              reviewer_feedback: selectedPaper.reviewer_feedback,
              published_date: selectedPaper.status === 'approved' ? new Date().toISOString().split('T')[0] : selectedPaper.published_date,
            })}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Reviewer Dialog */}
      <Dialog open={assignReviewerOpen} onOpenChange={setAssignReviewerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Reviewer</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Paper: {selectedPaper?.title}</p>
            <div>
              <Label>Select Reviewer</Label>
              <Select value={reviewerId} onValueChange={setReviewerId}>
                <SelectTrigger><SelectValue placeholder="Choose reviewer..." /></SelectTrigger>
                <SelectContent>
                  {instructors.map((i: any) => (
                    <SelectItem key={i.user_id} value={i.user_id}>
                      {i.user_profiles?.full_name || i.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignReviewerOpen(false)}>Cancel</Button>
            <Button onClick={() => assignReviewerMutation.mutate()} disabled={!reviewerId}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminResearchPapers;
