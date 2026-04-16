import { CardGridSkeleton } from '@/components/ui/loading-skeletons';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, Plus, Edit2, Trash2, ExternalLink, Calendar, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  live: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};

const emptyForm = {
  title: '', description: '', meeting_url: '', platform: 'zoom',
  start_time: '', duration_minutes: 60, recording_url: '', status: 'scheduled',
  course_id: '', batch_id: '',
};

const AdminLiveClasses = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState('upcoming');

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['admin-live-classes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('live_classes')
        .select('*, courses(title), batches(name), user_profiles:created_by(full_name)')
        .order('start_time', { ascending: false });
      return data ?? [];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['all-courses-select'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').order('title');
      return data ?? [];
    },
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['all-batches-select'],
    queryFn: async () => {
      const { data } = await supabase.from('batches').select('id, name').order('name');
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title,
        description: form.description || null,
        meeting_url: form.meeting_url || null,
        platform: form.platform,
        start_time: form.start_time,
        duration_minutes: form.duration_minutes,
        recording_url: form.recording_url || null,
        status: form.status,
        course_id: form.course_id || null,
        batch_id: form.batch_id || null,
      };
      if (editing) {
        const { error } = await supabase.from('live_classes').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        payload.created_by = user!.id;
        const { error } = await supabase.from('live_classes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-live-classes'] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? 'Live class updated' : 'Live class created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('live_classes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-live-classes'] });
      toast.success('Live class deleted');
    },
  });

  const openEdit = (cls: any) => {
    setEditing(cls);
    setForm({
      title: cls.title,
      description: cls.description || '',
      meeting_url: cls.meeting_url || '',
      platform: cls.platform,
      start_time: cls.start_time ? format(new Date(cls.start_time), "yyyy-MM-dd'T'HH:mm") : '',
      duration_minutes: cls.duration_minutes,
      recording_url: cls.recording_url || '',
      status: cls.status,
      course_id: cls.course_id || '',
      batch_id: cls.batch_id || '',
    });
    setOpen(true);
  };

  const now = new Date();
  const upcoming = classes.filter((c: any) => new Date(c.start_time) >= now && c.status !== 'cancelled');
  const past = classes.filter((c: any) => new Date(c.start_time) < now || c.status === 'completed');
  const cancelled = classes.filter((c: any) => c.status === 'cancelled');
  const filtered = tab === 'upcoming' ? upcoming : tab === 'past' ? past : cancelled;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Live Classes</h1>
          <p className="text-sm text-muted-foreground">Schedule and manage Zoom/Meet sessions</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }} className="gap-1">
          <Plus className="h-4 w-4" /> Schedule Class
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{upcoming.length}</p><p className="text-xs text-muted-foreground">Upcoming</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{past.length}</p><p className="text-xs text-muted-foreground">Completed</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{classes.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({cancelled.length})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {isLoading ? (
            <CardGridSkeleton count={3} columns={3} />
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><Video className="h-12 w-12 mx-auto mb-3 text-muted" /><p>No {tab} classes.</p></CardContent></Card>
          ) : (
            filtered.map((cls: any) => (
              <Card key={cls.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{cls.title}</h3>
                        <Badge className={`text-[10px] ${statusColors[cls.status] || ''}`}>{cls.status}</Badge>
                        <Badge variant="outline" className="text-[10px]">{cls.platform}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(cls.start_time), 'PPP p')}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{cls.duration_minutes} min</span>
                        {cls.courses?.title && <span>Course: {cls.courses.title}</span>}
                        {cls.batches?.name && <span>Batch: {cls.batches.name}</span>}
                      </div>
                      {cls.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cls.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {cls.meeting_url && (
                        <a href={cls.meeting_url} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm" className="text-xs gap-1"><ExternalLink className="h-3 w-3" /> Join</Button>
                        </a>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cls)}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(cls.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Live Class' : 'Schedule Live Class'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Platform</Label>
                <Select value={form.platform} onValueChange={v => setForm(p => ({ ...p, platform: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zoom">Zoom</SelectItem>
                    <SelectItem value="meet">Google Meet</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Meeting URL</Label><Input value={form.meeting_url} onChange={e => setForm(p => ({ ...p, meeting_url: e.target.value }))} placeholder="https://zoom.us/j/..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Time *</Label><Input type="datetime-local" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} /></div>
              <div><Label>Duration (min)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 60 }))} /></div>
            </div>
            <div>
              <Label>Course (optional)</Label>
              <Select value={form.course_id} onValueChange={v => setForm(p => ({ ...p, course_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>{courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Batch (optional)</Label>
              <Select value={form.batch_id} onValueChange={v => setForm(p => ({ ...p, batch_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                <SelectContent>{batches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Recording URL (post-session)</Label><Input value={form.recording_url} onChange={e => setForm(p => ({ ...p, recording_url: e.target.value }))} placeholder="https://..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.title || !form.start_time || saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLiveClasses;
