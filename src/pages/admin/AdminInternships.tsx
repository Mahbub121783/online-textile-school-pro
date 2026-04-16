import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit2, Trash2, Briefcase, Eye, Users, Star, Download, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm: any = {
  title: '', company: '', description: '', requirements: '', stipend: '',
  duration: '', application_deadline: '', status: 'open', is_published: false,
  location: '', internship_type: 'onsite', department: '', positions_available: 1,
  skills_required: '', contact_email: '', is_featured: false, supervisor_id: '',
};

const AdminInternships = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedInternship, setSelectedInternship] = useState<any>(null);
  const [appStatusFilter, setAppStatusFilter] = useState('all');

  const { data: internships = [], isLoading } = useQuery({
    queryKey: ['admin-internships'],
    queryFn: async () => {
      const { data } = await supabase.from('internships').select('*, supervisor:user_profiles!internships_supervisor_id_fkey(full_name)').order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: instructors = [] } = useQuery({
    queryKey: ['admin-instructors-list'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id, user:user_profiles!user_roles_user_id_fkey(id, full_name)').eq('role', 'instructor');
      return data ?? [];
    },
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['admin-intern-apps', selectedInternship?.id],
    queryFn: async () => {
      if (!selectedInternship) return [];
      const { data } = await supabase
        .from('internship_applications')
        .select('*, applicant:user_profiles!internship_applications_user_id_fkey(full_name, avatar_url)')
        .eq('internship_id', selectedInternship.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!selectedInternship,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title, company: form.company, description: form.description || null,
        requirements: form.requirements || null, stipend: form.stipend || null,
        duration: form.duration || null, application_deadline: form.application_deadline || null,
        status: form.status, is_published: form.is_published,
        location: form.location || null, internship_type: form.internship_type,
        department: form.department || null, positions_available: parseInt(form.positions_available) || 1,
        skills_required: form.skills_required ? form.skills_required.split(',').map((s: string) => s.trim()).filter(Boolean) : null,
        contact_email: form.contact_email || null, is_featured: form.is_featured,
        supervisor_id: form.supervisor_id || null,
        posted_by: user?.id,
      };
      if (editing) {
        const { error } = await supabase.from('internships').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('internships').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-internships'] });
      setOpen(false); setEditing(null); setForm(emptyForm);
      toast.success(editing ? 'Updated!' : 'Created!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('internships').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-internships'] });
      toast.success('Deleted');
    },
  });

  const updateAppStatusMutation = useMutation({
    mutationFn: async ({ appId, status }: { appId: string; status: string }) => {
      const { error } = await supabase.from('internship_applications').update({ status, reviewed_by: user?.id }).eq('id', appId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-intern-apps'] });
      toast.success('Status updated');
    },
  });

  const openEdit = (i: any) => {
    setEditing(i);
    setForm({
      ...i,
      skills_required: i.skills_required?.join(', ') || '',
      positions_available: i.positions_available?.toString() || '1',
      supervisor_id: i.supervisor_id || '',
    });
    setOpen(true);
  };

  const exportCSV = () => {
    if (!applications.length) return;
    const headers = ['Name', 'Status', 'Rating', 'Applied', 'Cover Letter', 'Resume', 'Portfolio', 'Skills'];
    const rows = applications.map((a: any) => [
      (a as any).applicant?.full_name || '', a.status, a.rating || '', new Date(a.created_at).toLocaleDateString(),
      a.cover_letter || '', a.resume_url || '', a.portfolio_url || '', a.skills?.join('; ') || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `applications-${selectedInternship.title}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Stats
  const totalApps = internships.reduce((sum: number, i: any) => sum + (i.positions_filled || 0), 0);
  const openCount = internships.filter((i: any) => i.status === 'open').length;
  const featuredCount = internships.filter((i: any) => i.is_featured).length;

  const filteredApps = appStatusFilter === 'all' ? applications : applications.filter((a: any) => a.status === appStatusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Internship Management</h1>
          <p className="text-muted-foreground text-sm">Create, manage internships and review applications</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Internship</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{internships.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{openCount}</p><p className="text-xs text-muted-foreground">Open</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{totalApps}</p><p className="text-xs text-muted-foreground">Positions Filled</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{featuredCount}</p><p className="text-xs text-muted-foreground">Featured</p></CardContent></Card>
      </div>

      {/* Internships Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Positions</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton rows={5} columns={7} />
              ) : internships.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No internships yet</TableCell></TableRow>
              ) : internships.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-sm">{i.title}</span>
                      {i.is_featured && <Star className="h-3 w-3 text-yellow-500" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{i.company}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize text-xs">{i.internship_type}</Badge></TableCell>
                  <TableCell className="text-sm">{i.positions_filled || 0}/{i.positions_available}</TableCell>
                  <TableCell className="text-xs">{(i as any).supervisor?.full_name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={i.is_published ? 'default' : 'secondary'} className="text-xs">
                      {i.is_published ? 'Published' : 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setSelectedInternship(i); setAppsOpen(true); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(i)}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(i.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Create'} Internship</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Label>Title *</Label><Input value={form.title} onChange={e => setForm((p: any) => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Company *</Label><Input value={form.company} onChange={e => setForm((p: any) => ({ ...p, company: e.target.value }))} /></div>
            <div><Label>Location</Label><Input value={form.location} onChange={e => setForm((p: any) => ({ ...p, location: e.target.value }))} placeholder="City or Remote" /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.internship_type} onValueChange={v => setForm((p: any) => ({ ...p, internship_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="onsite">On-site</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Department</Label><Input value={form.department} onChange={e => setForm((p: any) => ({ ...p, department: e.target.value }))} /></div>
            <div><Label>Stipend</Label><Input value={form.stipend} onChange={e => setForm((p: any) => ({ ...p, stipend: e.target.value }))} /></div>
            <div><Label>Duration</Label><Input value={form.duration} onChange={e => setForm((p: any) => ({ ...p, duration: e.target.value }))} /></div>
            <div><Label>Positions Available</Label><Input type="number" value={form.positions_available} onChange={e => setForm((p: any) => ({ ...p, positions_available: e.target.value }))} /></div>
            <div><Label>Contact Email</Label><Input type="email" value={form.contact_email} onChange={e => setForm((p: any) => ({ ...p, contact_email: e.target.value }))} /></div>
            <div><Label>Deadline</Label><Input type="date" value={form.application_deadline} onChange={e => setForm((p: any) => ({ ...p, application_deadline: e.target.value }))} /></div>
            <div>
              <Label>Supervisor (Instructor)</Label>
              <Select value={form.supervisor_id} onValueChange={v => setForm((p: any) => ({ ...p, supervisor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {instructors.map((inst: any) => (
                    <SelectItem key={inst.user_id} value={inst.user_id}>{(inst as any).user?.full_name || inst.user_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm((p: any) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Skills Required (comma-separated)</Label><Input value={form.skills_required} onChange={e => setForm((p: any) => ({ ...p, skills_required: e.target.value }))} placeholder="React, Python, Data Analysis" /></div>
            <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))} rows={3} /></div>
            <div className="col-span-2"><Label>Requirements</Label><Textarea value={form.requirements} onChange={e => setForm((p: any) => ({ ...p, requirements: e.target.value }))} rows={3} /></div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_published} onCheckedChange={v => setForm((p: any) => ({ ...p, is_published: v }))} />
              <Label>Published</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_featured} onCheckedChange={v => setForm((p: any) => ({ ...p, is_featured: v }))} />
              <Label>Featured</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title || !form.company}>
              {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Applications Dialog */}
      <Dialog open={appsOpen} onOpenChange={setAppsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Applications — {selectedInternship?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between mb-4">
            <Select value={appStatusFilter} onValueChange={setAppStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {['applied', 'shortlisted', 'interviewed', 'offered', 'accepted', 'rejected'].map(s =>
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={exportCSV} disabled={!applications.length}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
            </Button>
          </div>
          {filteredApps.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No applications found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Resume</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApps.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{(a as any).applicant?.full_name || 'Unknown'}</p>
                      {a.skills?.length > 0 && <p className="text-[10px] text-muted-foreground">{a.skills.join(', ')}</p>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-xs">{a.status}</Badge></TableCell>
                    <TableCell>{a.rating ? <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-yellow-500" />{a.rating}</span> : '—'}</TableCell>
                    <TableCell>
                      {a.resume_url ? <a href={a.resume_url} target="_blank" className="text-xs text-primary underline">View</a> : '—'}
                    </TableCell>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Select value={a.status} onValueChange={v => updateAppStatusMutation.mutate({ appId: a.id, status: v })}>
                        <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['applied', 'shortlisted', 'interviewed', 'offered', 'accepted', 'rejected'].map(s =>
                            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInternships;
