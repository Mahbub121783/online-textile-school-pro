import { TableSkeleton } from '@/components/ui/loading-skeletons';
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
import { Plus, Edit2, Trash2, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
  title: '', description: '', course_id: '', simulation_url: '',
  type: 'iframe', instructions: '', is_published: false, sort_order: 0,
};

const AdminVirtualLabs = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: courses = [] } = useQuery({
    queryKey: ['courses-for-labs'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').order('title');
      return data ?? [];
    },
  });

  const { data: labs = [], isLoading } = useQuery({
    queryKey: ['admin-virtual-labs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_labs')
        .select('*, courses(title)')
        .order('sort_order')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description || null,
        course_id: form.course_id || null,
        simulation_url: form.simulation_url,
        type: form.type,
        instructions: form.instructions || null,
        is_published: form.is_published,
        sort_order: form.sort_order,
        created_by: user?.id,
      };
      if (editing) {
        const { error } = await supabase.from('virtual_labs').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('virtual_labs').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-virtual-labs'] });
      setOpen(false); setEditing(null); setForm(emptyForm);
      toast.success(editing ? 'Lab updated' : 'Lab created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('virtual_labs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-virtual-labs'] });
      toast.success('Lab deleted');
    },
  });

  const openEdit = (l: any) => {
    setEditing(l);
    setForm({
      title: l.title, description: l.description || '', course_id: l.course_id || '',
      simulation_url: l.simulation_url, type: l.type, instructions: l.instructions || '',
      is_published: l.is_published, sort_order: l.sort_order,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Virtual Labs</h1>
          <p className="text-sm text-muted-foreground">Manage simulation and lab environments</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }} className="gap-1">
          <Plus className="h-4 w-4" /> Add Lab
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton rows={5} columns={5} />
              ) : labs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  <FlaskConical className="h-8 w-8 mx-auto mb-2 text-muted" />No virtual labs.
                </TableCell></TableRow>
              ) : (
                labs.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.courses?.title || 'General'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{l.type}</Badge></TableCell>
                    <TableCell><Badge variant={l.is_published ? 'default' : 'secondary'} className="text-[10px]">{l.is_published ? 'Yes' : 'No'}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(l)}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Lab' : 'Add Lab'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div><Label>Simulation URL *</Label><Input value={form.simulation_url} onChange={e => setForm(p => ({ ...p, simulation_url: e.target.value }))} placeholder="https://..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iframe">iFrame Embed</SelectItem>
                    <SelectItem value="external">External Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Course (optional)</Label>
                <Select value={form.course_id} onValueChange={v => setForm(p => ({ ...p, course_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">General</SelectItem>
                    {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Instructions</Label><Textarea value={form.instructions} onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} /></div>
              <div className="flex items-center gap-2 pt-6"><Switch checked={form.is_published} onCheckedChange={v => setForm(p => ({ ...p, is_published: v }))} /><Label>Published</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.title || !form.simulation_url || saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminVirtualLabs;
