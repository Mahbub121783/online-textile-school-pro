import { useState } from 'react';
import { Plus, Edit, Trash2, Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAllVideoCategories, type ClassVideo } from '@/hooks/useClassVideos';
import { Link } from 'react-router-dom';

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const EMPTY = {
  title: '', slug: '', description: '', category_id: '',
  video_url: '', video_platform: 'upload' as 'upload' | 'drive' | 'youtube',
  clip_start_seconds: 0, clip_end_seconds: null as number | null,
  duration_seconds: null as number | null, tags: '' as string,
  visibility: 'public' as 'public' | 'logged_in' | 'paid',
  required_course_id: '', is_published: true, is_featured: false,
};

export default function AdminClassVideos() {
  const qc = useQueryClient();
  const { data: cats } = useAllVideoCategories();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassVideo | null>(null);
  const [form, setForm] = useState(EMPTY);

  const { data: videos, isLoading } = useQuery({
    queryKey: ['admin-class-videos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_videos').select('*, video_categories(name, slug)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClassVideo[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { user } = (await supabase.auth.getUser()).data;
      const payload: any = {
        title: form.title,
        slug: form.slug || slugify(form.title),
        description: form.description || null,
        thumbnail_url: null,
        category_id: form.category_id || null,
        video_url: form.video_url,
        video_platform: form.video_platform,
        clip_start_seconds: Math.max(0, form.clip_start_seconds || 0),
        clip_end_seconds: form.clip_end_seconds || null,
        duration_seconds: form.duration_seconds || null,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        visibility: form.visibility,
        required_course_id: form.visibility === 'paid' && form.required_course_id ? form.required_course_id : null,
        is_published: form.is_published,
        is_featured: form.is_featured,
      };
      if (editing) {
        const { error } = await supabase.from('class_videos').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        payload.uploaded_by = user?.id;
        const { error } = await supabase.from('class_videos').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? 'Updated' : 'Created' });
      qc.invalidateQueries({ queryKey: ['admin-class-videos'] });
      qc.invalidateQueries({ queryKey: ['class-videos'] });
      setOpen(false); setEditing(null);
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('class_videos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-class-videos'] });
      toast({ title: 'Deleted' });
    },
  });

  const startEdit = (v: ClassVideo) => {
    setEditing(v);
    setForm({
      title: v.title, slug: v.slug, description: v.description ?? '',
      category_id: v.category_id ?? '',
      video_url: v.video_url, video_platform: v.video_platform,
      clip_start_seconds: v.clip_start_seconds, clip_end_seconds: v.clip_end_seconds,
      duration_seconds: v.duration_seconds, tags: (v.tags ?? []).join(', '),
      visibility: v.visibility, required_course_id: v.required_course_id ?? '',
      is_published: v.is_published, is_featured: v.is_featured,
    });
    setOpen(true);
  };

  const startNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Class Videos</h1>
          <p className="text-sm text-muted-foreground">Manage free class video library</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/admin/class-video-categories">Categories</Link></Button>
          <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Add Video</Button>
        </div>
      </div>

      {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead><TableHead>Category</TableHead>
              <TableHead>Source</TableHead><TableHead>Visibility</TableHead>
              <TableHead>Stats</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos?.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium max-w-[280px] truncate">
                  {v.is_featured && <Star className="inline h-3 w-3 mr-1 fill-current text-yellow-500" />}
                  {v.title}
                  {!v.is_published && <Badge variant="outline" className="ml-2 text-[10px]">Draft</Badge>}
                </TableCell>
                <TableCell className="text-sm">{(v as any).video_categories?.name || '—'}</TableCell>
                <TableCell><Badge variant="secondary">{v.video_platform}</Badge></TableCell>
                <TableCell><Badge>{v.visibility}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {v.views_count}v · {v.likes_count}♥ · {v.comments_count}💬
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(v)}><Edit className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm('Delete?') && del.mutate(v.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Video</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={form.slug} placeholder={slugify(form.title)} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Thumbnail er dorkar nai — card-e direct video preview hover/scroll-e auto-play hobe (reel-style).</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category_id || 'none'} onValueChange={(v) => setForm({ ...form, category_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {cats?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source</Label>
                <Select value={form.video_platform} onValueChange={(v: any) => setForm({ ...form, video_platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upload">Direct upload URL</SelectItem>
                    <SelectItem value="drive">Google Drive</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div><Label>Video URL *</Label><Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://..." /></div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Clip start (sec)</Label>
                <Input type="number" min={0} value={form.clip_start_seconds}
                  onChange={(e) => setForm({ ...form, clip_start_seconds: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Clip end (sec)</Label>
                <Input type="number" min={0} value={form.clip_end_seconds ?? ''}
                  onChange={(e) => setForm({ ...form, clip_end_seconds: e.target.value ? parseInt(e.target.value) : null })} />
              </div>
              <div>
                <Label>Total duration</Label>
                <Input type="number" min={0} value={form.duration_seconds ?? ''}
                  onChange={(e) => setForm({ ...form, duration_seconds: e.target.value ? parseInt(e.target.value) : null })} />
              </div>
            </div>

            <div><Label>Tags (comma separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Visibility</Label>
                <Select value={form.visibility} onValueChange={(v: any) => setForm({ ...form, visibility: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public — anyone</SelectItem>
                    <SelectItem value="logged_in">Logged-in users only</SelectItem>
                    <SelectItem value="paid">Paid (course-gated)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.visibility === 'paid' && (
                <div>
                  <Label>Required course ID</Label>
                  <Input value={form.required_course_id} placeholder="(blank = any login)"
                    onChange={(e) => setForm({ ...form, required_course_id: e.target.value })} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} /><Label>Published</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} /><Label>Featured</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title || !form.video_url}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
