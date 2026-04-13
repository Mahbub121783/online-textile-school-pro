import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { GraduationCap, Plus, Edit, Trash2, BookOpen } from 'lucide-react';
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

const AdminLearningPaths = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', slug: '', description: '', thumbnail_url: '', price: '0', is_published: false, courseSearch: '' });
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [mediaOpen, setMediaOpen] = useState(false);

  const { data: paths = [] } = useQuery({
    queryKey: ['admin-learning-paths'],
    queryFn: async () => { const { data } = await supabase.from('learning_paths').select('*').order('created_at', { ascending: false }); return data ?? []; },
  });

  const { data: allCourses = [] } = useQuery({
    queryKey: ['all-courses-for-paths'],
    queryFn: async () => { const { data } = await supabase.from('courses').select('id, title, slug').eq('is_published', true).order('title'); return data ?? []; },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = { title: form.title, slug: form.slug, description: form.description, thumbnail_url: form.thumbnail_url || null, price: parseFloat(form.price) || 0, is_published: form.is_published, course_ids: selectedCourseIds, created_by: user?.id };
      if (editing) { await supabase.from('learning_paths').update(payload).eq('id', editing.id); }
      else { await supabase.from('learning_paths').insert(payload); }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-learning-paths'] }); setDialogOpen(false); toast({ title: editing ? 'Updated' : 'Created' }); },
  });

  const deletePath = useMutation({
    mutationFn: async (id: string) => { await supabase.from('learning_paths').delete().eq('id', id); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-learning-paths'] }); toast({ title: 'Deleted' }); },
  });

  const openCreate = () => { setEditing(null); setForm({ title: '', slug: '', description: '', thumbnail_url: '', price: '0', is_published: false, courseSearch: '' }); setSelectedCourseIds([]); setDialogOpen(true); };
  const openEdit = (p: any) => { setEditing(p); setForm({ title: p.title, slug: p.slug, description: p.description || '', thumbnail_url: p.thumbnail_url || '', price: p.price?.toString() || '0', is_published: p.is_published, courseSearch: '' }); setSelectedCourseIds(p.course_ids || []); setDialogOpen(true); };

  const filteredCourses = allCourses.filter((c: any) => !selectedCourseIds.includes(c.id) && c.title.toLowerCase().includes(form.courseSearch.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Learning Paths</h1>
          <Badge variant="secondary">{paths.length}</Badge>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Create Path</Button>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Courses</TableHead><TableHead>Price</TableHead><TableHead>Published</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {paths.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell><Badge variant="outline">{p.course_ids?.length || 0} courses</Badge></TableCell>
                <TableCell>{p.price === 0 ? 'Free' : `৳${p.price}`}</TableCell>
                <TableCell>{p.is_published ? <Badge>Published</Badge> : <Badge variant="secondary">Draft</Badge>}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deletePath.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {paths.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No learning paths yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Path' : 'Create Path'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') })} required /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Price (৳)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div>
                <Label>Thumbnail</Label>
                <div className="flex gap-2"><Input value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} className="flex-1" /><Button type="button" variant="outline" onClick={() => setMediaOpen(true)}>Media</Button></div>
              </div>
            </div>
            <div>
              <Label>Courses in Path ({selectedCourseIds.length})</Label>
              <div className="space-y-2 mt-2">
                {selectedCourseIds.map((id, idx) => {
                  const c = allCourses.find((c: any) => c.id === id);
                  return (
                    <div key={id} className="flex items-center gap-2 p-2 bg-secondary rounded">
                      <span className="text-sm font-medium w-6">{idx + 1}.</span>
                      <span className="flex-1 text-sm">{c?.title || id}</span>
                      <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSelectedCourseIds(selectedCourseIds.filter(i => i !== id))}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  );
                })}
              </div>
              <Input placeholder="Search courses to add..." value={form.courseSearch} onChange={(e) => setForm({ ...form, courseSearch: e.target.value })} className="mt-2" />
              {form.courseSearch && (
                <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                  {filteredCourses.slice(0, 10).map((c: any) => (
                    <button type="button" key={c.id} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors" onClick={() => { setSelectedCourseIds([...selectedCourseIds, c.id]); setForm({ ...form, courseSearch: '' }); }}>
                      <BookOpen className="h-3 w-3 inline mr-2" />{c.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_published} onCheckedChange={(c) => setForm({ ...form, is_published: c })} /><Label>Published</Label></div>
            <Button type="submit" className="w-full" disabled={upsert.isPending}>{editing ? 'Update' : 'Create'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <MediaPickerModal open={mediaOpen} onClose={() => setMediaOpen(false)} onSelect={(url) => { setForm({ ...form, thumbnail_url: url }); setMediaOpen(false); }} />
    </div>
  );
};

export default AdminLearningPaths;
