import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GraduationCap, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import MediaPickerModal from '@/components/shared/MediaPickerModal';

const AdminSuccessStories = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', story: '', photo_url: '', course_title: '', graduation_year: '', job_title: '', is_featured: false });
  const [mediaOpen, setMediaOpen] = useState(false);

  const { data: stories = [] } = useQuery({
    queryKey: ['admin-stories'],
    queryFn: async () => { const { data } = await supabase.from('success_stories').select('*').order('created_at', { ascending: false }); return data ?? []; },
  });

  const upsert = useMutation({
    mutationFn: async (values: any) => {
      const payload = { ...values, graduation_year: values.graduation_year ? parseInt(values.graduation_year) : null };
      if (editing) { await supabase.from('success_stories').update(payload).eq('id', editing.id); }
      else { await supabase.from('success_stories').insert(payload); }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-stories'] }); setDialogOpen(false); toast({ title: editing ? 'Updated' : 'Created' }); },
  });

  const deleteStory = useMutation({
    mutationFn: async (id: string) => { await supabase.from('success_stories').delete().eq('id', id); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-stories'] }); toast({ title: 'Deleted' }); },
  });

  const openCreate = () => { setEditing(null); setForm({ name: '', story: '', photo_url: '', course_title: '', graduation_year: '', job_title: '', is_featured: false }); setDialogOpen(true); };
  const openEdit = (s: any) => { setEditing(s); setForm({ name: s.name, story: s.story, photo_url: s.photo_url || '', course_title: s.course_title || '', graduation_year: s.graduation_year?.toString() || '', job_title: s.job_title || '', is_featured: s.is_featured }); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Success Stories</h1>
          <Badge variant="secondary">{stories.length}</Badge>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Story</Button>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Year</TableHead><TableHead>Featured</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {stories.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.job_title || '—'}</TableCell>
                <TableCell>{s.graduation_year || '—'}</TableCell>
                <TableCell>{s.is_featured ? '⭐' : '—'}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Edit className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteStory.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {stories.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No stories yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Story' : 'Add Story'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(form); }} className="space-y-4">
            <div><Label>Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><Label>Story</Label><Textarea value={form.story} onChange={(e) => setForm({ ...form, story: e.target.value })} required rows={4} /></div>
            <div>
              <Label>Photo</Label>
              <div className="flex gap-2"><Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} placeholder="URL" className="flex-1" /><Button type="button" variant="outline" onClick={() => setMediaOpen(true)}>Media</Button></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Course Title</Label><Input value={form.course_title} onChange={(e) => setForm({ ...form, course_title: e.target.value })} /></div>
              <div><Label>Graduation Year</Label><Input type="number" value={form.graduation_year} onChange={(e) => setForm({ ...form, graduation_year: e.target.value })} /></div>
            </div>
            <div><Label>Current Job Title</Label><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_featured} onCheckedChange={(c) => setForm({ ...form, is_featured: c })} /><Label>Featured</Label></div>
            <Button type="submit" className="w-full" disabled={upsert.isPending}>{editing ? 'Update' : 'Create'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <MediaPickerModal open={mediaOpen} onClose={() => setMediaOpen(false)} onSelect={(url) => { setForm({ ...form, photo_url: url }); setMediaOpen(false); }} />
    </div>
  );
};

export default AdminSuccessStories;
