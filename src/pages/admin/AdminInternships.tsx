import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2, Briefcase, Eye } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
  title: '', company: '', description: '', requirements: '', stipend: '',
  duration: '', application_deadline: '', status: 'open', is_published: false,
};

const AdminInternships = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedInternship, setSelectedInternship] = useState<any>(null);

  const { data: internships = [], isLoading } = useQuery({
    queryKey: ['admin-internships'],
    queryFn: async () => {
      const { data, error } = await supabase.from('internships').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        application_deadline: form.application_deadline || null,
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
      toast.success(editing ? 'Internship updated' : 'Internship created');
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
      toast.success('Internship deleted');
    },
  });

  // Applications for selected internship
  const { data: applications = [] } = useQuery({
    queryKey: ['internship-apps', selectedInternship?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('internship_applications')
        .select('*, user_profiles:user_id(full_name, roll_id)')
        .eq('internship_id', selectedInternship.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!selectedInternship?.id,
  });

  const updateAppStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('internship_applications').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internship-apps'] });
      toast.success('Application status updated');
    },
  });

  const openEdit = (i: any) => {
    setEditing(i);
    setForm({
      title: i.title, company: i.company, description: i.description || '',
      requirements: i.requirements || '', stipend: i.stipend || '', duration: i.duration || '',
      application_deadline: i.application_deadline?.split('T')[0] || '', status: i.status,
      is_published: i.is_published,
    });
    setOpen(true);
  };

  const statusColors: Record<string, string> = {
    applied: 'bg-blue-500', shortlisted: 'bg-amber-500', interviewed: 'bg-purple-500',
    offered: 'bg-green-500', rejected: 'bg-destructive',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Internship Management</h1>
          <p className="text-sm text-muted-foreground">Post and manage internship opportunities</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }} className="gap-1">
          <Plus className="h-4 w-4" /> Post Internship
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 animate-pulse text-muted-foreground">Loading...</TableCell></TableRow>
              ) : internships.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Briefcase className="h-8 w-8 mx-auto mb-2 text-muted" />No internships posted.
                </TableCell></TableRow>
              ) : (
                internships.map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{i.company}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{i.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {i.application_deadline ? new Date(i.application_deadline).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell><Badge variant={i.is_published ? 'default' : 'secondary'} className="text-[10px]">{i.is_published ? 'Yes' : 'No'}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedInternship(i); setAppsOpen(true); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(i)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(i.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Internship' : 'Post Internship'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Company *</Label><Input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} /></div>
            <div><Label>Requirements</Label><Textarea value={form.requirements} onChange={e => setForm(p => ({ ...p, requirements: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Stipend</Label><Input value={form.stipend} onChange={e => setForm(p => ({ ...p, stipend: e.target.value }))} placeholder="e.g., $500/mo" /></div>
              <div><Label>Duration</Label><Input value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} placeholder="e.g., 3 months" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Deadline</Label><Input type="date" value={form.application_deadline} onChange={e => setForm(p => ({ ...p, application_deadline: e.target.value }))} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="filled">Filled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_published} onCheckedChange={v => setForm(p => ({ ...p, is_published: v }))} />
              <Label>Published</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.title || !form.company || saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Applications Dialog */}
      <Dialog open={appsOpen} onOpenChange={setAppsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Applications — {selectedInternship?.title}</DialogTitle></DialogHeader>
          {applications.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No applications yet.</p>
          ) : (
            <div className="space-y-3">
              {applications.map((app: any) => (
                <div key={app.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{app.user_profiles?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{app.user_profiles?.roll_id} · Applied {new Date(app.created_at).toLocaleDateString()}</p>
                    </div>
                    <Select value={app.status} onValueChange={v => updateAppStatus.mutate({ id: app.id, status: v })}>
                      <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['applied', 'shortlisted', 'interviewed', 'offered', 'rejected'].map(s => (
                          <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {app.cover_letter && <p className="text-sm text-muted-foreground">{app.cover_letter}</p>}
                  {app.resume_url && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                      <a href={app.resume_url} target="_blank" rel="noopener noreferrer">View Resume</a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInternships;
