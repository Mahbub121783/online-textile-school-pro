import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Megaphone, Plus, Pin, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { toast } from 'sonner';

const InstructorAnnouncements = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', content: '', course_id: '', is_pinned: false });

  const { data: courses = [] } = useQuery({
    queryKey: ['instructor-courses-list', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').eq('instructor_id', user!.id);
      return data ?? [];
    },
  });

  const courseIds = selectedCourse === 'all' ? courses.map((c: any) => c.id) : [selectedCourse];

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['instructor-announcements', courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase.from('course_announcements') as any)
        .select('*, courses:course_id(title)')
        .in('course_id', courseIds)
        .eq('instructor_id', user!.id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.course_id) throw new Error('Title and course are required');
      if (editId) {
        const { error } = await (supabase.from('course_announcements') as any)
          .update({ title: form.title, content: form.content, is_pinned: form.is_pinned })
          .eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('course_announcements') as any)
          .insert({ title: form.title, content: form.content, course_id: form.course_id, instructor_id: user!.id, is_pinned: form.is_pinned });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-announcements'] });
      setShowModal(false);
      setEditId(null);
      setForm({ title: '', content: '', course_id: '', is_pinned: false });
      toast.success(editId ? 'Announcement updated' : 'Announcement created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('course_announcements') as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-announcements'] });
      toast.success('Announcement deleted');
    },
  });

  const openEdit = (a: any) => {
    setEditId(a.id);
    setForm({ title: a.title, content: a.content || '', course_id: a.course_id, is_pinned: a.is_pinned });
    setShowModal(true);
  };

  const openNew = () => {
    setEditId(null);
    setForm({ title: '', content: '', course_id: selectedCourse === 'all' ? (courses[0]?.id || '') : selectedCourse, is_pinned: false });
    setShowModal(true);
  };

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="font-heading text-2xl font-bold">Announcements</h2>
        <div className="flex items-center gap-3">
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Filter by course" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /> New</Button>
        </div>
      </div>

      {announcements.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Megaphone className="h-16 w-16 mx-auto mb-4 text-muted" />
          <p>No announcements yet. Create one to notify your students.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a: any) => (
            <div key={a.id} className="bg-card border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.is_pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                    <h3 className="font-heading font-semibold text-sm">{a.title}</h3>
                    <Badge variant="outline" className="text-[10px]">{a.courses?.title}</Badge>
                  </div>
                  {a.content && <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{a.content}</p>}
                  <p className="text-xs text-muted-foreground mt-2">{format(new Date(a.created_at), 'dd MMM yyyy, HH:mm')}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Edit Announcement' : 'New Announcement'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!editId && (
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={form.course_id} onValueChange={(v) => setForm((f) => ({ ...f, course_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>{courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Announcement title" />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={4} placeholder="Write your announcement..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_pinned} onCheckedChange={(v) => setForm((f) => ({ ...f, is_pinned: v }))} />
              <Label>Pin to top</Label>
            </div>
            <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {editId ? 'Update' : 'Create'} Announcement
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstructorAnnouncements;
