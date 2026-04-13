import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const EVENT_TYPES = [
  { value: 'semester_start', label: 'Semester Start', color: '#22c55e' },
  { value: 'semester_end', label: 'Semester End', color: '#ef4444' },
  { value: 'exam_week', label: 'Exam Week', color: '#f59e0b' },
  { value: 'holiday', label: 'Holiday', color: '#8b5cf6' },
  { value: 'deadline', label: 'Deadline', color: '#ec4899' },
  { value: 'registration', label: 'Registration', color: '#06b6d4' },
  { value: 'other', label: 'Other', color: '#3b82f6' },
];

const AdminAcademicCalendar = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({
    title: '', description: '', event_type: 'other', start_date: '', end_date: '', batch_id: '', is_global: true, color: '#3b82f6',
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['academic-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase.from('academic_calendar' as any).select('*, batches:batch_id(name)').order('start_date', { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches-list'],
    queryFn: async () => {
      const { data } = await supabase.from('batches' as any).select('id, name').order('name');
      return (data || []) as any[];
    },
  });

  const saveEvent = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description || null,
        event_type: form.event_type,
        start_date: form.start_date,
        end_date: form.end_date || null,
        batch_id: form.batch_id || null,
        is_global: form.is_global,
        color: form.color,
        created_by: user?.id,
      };
      if (editItem) {
        const { error } = await supabase.from('academic_calendar' as any).update(payload).eq('id', editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('academic_calendar' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-calendar'] });
      toast.success(editItem ? 'Event updated' : 'Event created');
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('academic_calendar' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-calendar'] });
      toast.success('Event deleted');
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditItem(null);
    setForm({ title: '', description: '', event_type: 'other', start_date: '', end_date: '', batch_id: '', is_global: true, color: '#3b82f6' });
  };

  const openEdit = (e: any) => {
    setEditItem(e);
    setForm({
      title: e.title, description: e.description || '', event_type: e.event_type, start_date: e.start_date, end_date: e.end_date || '',
      batch_id: e.batch_id || '', is_global: e.is_global, color: e.color || '#3b82f6',
    });
    setShowForm(true);
  };

  const getTypeLabel = (t: string) => EVENT_TYPES.find(et => et.value === t)?.label || t;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">Academic Calendar</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }}><Plus className="h-4 w-4 mr-2" /> Add Event</Button>
      </div>

      {/* Calendar Cards - grouped by month */}
      <div className="grid gap-4 md:grid-cols-3">
        {EVENT_TYPES.map(et => {
          const count = events.filter(e => e.event_type === et.value).length;
          return (
            <Card key={et.value}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: et.color }} />
                  {et.label}
                </CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{count}</p></CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editItem ? 'Edit Event' : 'Add Calendar Event'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Mid-term Exam Week" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Event Type</Label>
                <Select value={form.event_type} onValueChange={v => {
                  const c = EVENT_TYPES.find(et => et.value === v)?.color || '#3b82f6';
                  setForm({ ...form, event_type: v, color: c });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EVENT_TYPES.map(et => <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Color</Label><Input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="h-10" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date *</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Batch (optional)</Label>
                <Select value={form.batch_id} onValueChange={v => setForm({ ...form, batch_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="All batches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All batches</SelectItem>
                    {batches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.is_global} onCheckedChange={v => setForm({ ...form, is_global: v })} />
                <Label>Global (visible to all)</Label>
              </div>
            </div>
            <Button onClick={() => saveEvent.mutate()} disabled={!form.title || !form.start_date || saveEvent.isPending} className="w-full">
              {saveEvent.isPending ? 'Saving...' : editItem ? 'Update Event' : 'Create Event'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Global</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center">Loading...</TableCell></TableRow>
            ) : events.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No events yet</TableCell></TableRow>
            ) : events.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }} />
                    <span className="font-medium">{e.title}</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{getTypeLabel(e.event_type)}</Badge></TableCell>
                <TableCell>{e.start_date}</TableCell>
                <TableCell>{e.end_date || '-'}</TableCell>
                <TableCell>{e.batches?.name || 'All'}</TableCell>
                <TableCell>{e.is_global ? '✓' : '—'}</TableCell>
                <TableCell className="space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(e)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteEvent.mutate(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default AdminAcademicCalendar;
