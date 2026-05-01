import { useState } from 'react';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { VideoCategory } from '@/hooks/useClassVideos';

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function AdminClassVideoCategories() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VideoCategory | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', icon: '', cover_url: '', sort_order: 0, is_active: true });

  const { data: cats, isLoading } = useQuery({
    queryKey: ['admin-video-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('video_categories').select('*').order('sort_order');
      if (error) throw error;
      return (data ?? []) as VideoCategory[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, slug: form.slug || slugify(form.name) };
      if (editing) {
        const { error } = await supabase.from('video_categories').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('video_categories').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? 'Updated' : 'Created' });
      qc.invalidateQueries({ queryKey: ['admin-video-categories'] });
      qc.invalidateQueries({ queryKey: ['video-categories'] });
      setOpen(false); setEditing(null);
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('video_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-video-categories'] });
      toast({ title: 'Deleted' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const startEdit = (c: VideoCategory) => {
    setEditing(c);
    setForm({
      name: c.name, slug: c.slug, description: c.description ?? '', icon: c.icon ?? '',
      cover_url: c.cover_url ?? '', sort_order: c.sort_order, is_active: c.is_active,
    });
    setOpen(true);
  };

  const startNew = () => {
    setEditing(null);
    setForm({ name: '', slug: '', description: '', icon: '', cover_url: '', sort_order: 0, is_active: true });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Video Categories</h1>
          <p className="text-sm text-muted-foreground">Subject buckets for class videos</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Add Category</Button>
      </div>

      {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Slug</TableHead>
              <TableHead>Order</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cats?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.icon} {c.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.slug}</TableCell>
                <TableCell>{c.sort_order}</TableCell>
                <TableCell>{c.is_active ? 'Yes' : 'No'}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(c)}><Edit className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm('Delete?') && del.mutate(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Category</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Slug (auto)</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder={slugify(form.name)} /></div>
            <div><Label>Icon (emoji)</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="🧶" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div><Label>Cover image URL</Label><Input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} /></div>
            <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
