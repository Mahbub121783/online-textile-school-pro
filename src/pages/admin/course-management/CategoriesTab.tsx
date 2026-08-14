import { useState } from 'react';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  icon_url: string | null;
  sort_order: number | null;
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function CategoriesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', icon_url: '', sort_order: 0, parent_id: '' as string });

  const { data: cats, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order');
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const nameById = new Map((cats ?? []).map((c) => [c.id, c.name]));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        slug: form.slug || slugify(form.name),
        icon_url: form.icon_url || null,
        sort_order: form.sort_order,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
      };
      if (editing) {
        const { error } = await supabase.from('categories').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? 'Updated' : 'Created' });
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['catalog-categories'] });
      setOpen(false); setEditing(null);
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      toast({ title: 'Deleted' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: 'This category may still be assigned to courses/ebooks. Reassign them first.', variant: 'destructive' }),
  });

  const startEdit = (c: Category) => {
    setEditing(c);
    setForm({
      name: c.name, slug: c.slug, icon_url: c.icon_url ?? '',
      sort_order: c.sort_order ?? 0, parent_id: c.parent_id ? String(c.parent_id) : '',
    });
    setOpen(true);
  };

  const startNew = () => {
    setEditing(null);
    setForm({ name: '', slug: '', icon_url: '', sort_order: (cats?.length ?? 0) + 1, parent_id: '' });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground">Used for course and ebook browsing/filtering (e.g. Spinning, Weaving, Dyeing).</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Add Category</Button>
      </div>

      {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Slug</TableHead>
              <TableHead>Parent</TableHead><TableHead>Order</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cats?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.icon_url && <span className="mr-1">{c.icon_url}</span>}{c.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.slug}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.parent_id ? nameById.get(c.parent_id) ?? '—' : '—'}</TableCell>
                <TableCell>{c.sort_order ?? 0}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(c)}><Edit className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm('Delete this category?') && del.mutate(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {cats?.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No categories yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Category</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Spinning Technology" /></div>
            <div><Label>Slug (auto)</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder={slugify(form.name)} /></div>
            <div><Label>Icon (emoji, optional)</Label><Input value={form.icon_url} onChange={(e) => setForm({ ...form, icon_url: e.target.value })} placeholder="🧵" /></div>
            <div>
              <Label>Parent category (optional)</Label>
              <Select value={form.parent_id} onValueChange={(v) => setForm({ ...form, parent_id: v === '__none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {cats?.filter((c) => c.id !== editing?.id).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} /></div>
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
