import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import MediaPickerModal from '@/components/shared/MediaPickerModal';

const AdminEvents = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', description: '', event_date: '', event_type: 'general', image_url: '', link: '', is_featured: false });
  const [mediaOpen, setMediaOpen] = useState(false);

  const { data: events = [] } = useQuery({
    queryKey: ['admin-events'],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*').order('event_date', { ascending: false });
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (values: any) => {
      if (editing) {
        await supabase.from('events').update(values).eq('id', editing.id);
      } else {
        await supabase.from('events').insert(values);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      setDialogOpen(false);
      setEditing(null);
      toast({ title: editing ? 'Event updated' : 'Event created' });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => { await supabase.from('events').delete().eq('id', id); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-events'] }); toast({ title: 'Event deleted' }); },
  });

  const openCreate = () => { setEditing(null); setForm({ title: '', description: '', event_date: '', event_type: 'general', image_url: '', link: '', is_featured: false }); setDialogOpen(true); };
  const openEdit = (e: any) => { setEditing(e); setForm({ title: e.title, description: e.description || '', event_date: e.event_date?.slice(0, 16) || '', event_type: e.event_type || 'general', image_url: e.image_url || '', link: e.link || '', is_featured: e.is_featured }); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Events Management</h1>
          <Badge variant="secondary">{events.length}</Badge>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Event</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event: any) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.title}</TableCell>
                <TableCell><Badge variant="outline">{event.event_type}</Badge></TableCell>
                <TableCell>{format(new Date(event.event_date), 'MMM dd, yyyy hh:mm a')}</TableCell>
                <TableCell>{event.is_featured ? '⭐' : '—'}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(event)}><Edit className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteEvent.mutate(event.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {events.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No events yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Event' : 'Create Event'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(form); }} className="space-y-4">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Date & Time</Label><Input type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} required /></div>
            <div>
              <Label>Event Type</Label>
              <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="webinar">Webinar</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="exam_schedule">Exam Schedule</SelectItem>
                  <SelectItem value="deadline">Deadline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Image</Label>
              <div className="flex gap-2">
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="Image URL" className="flex-1" />
                <Button type="button" variant="outline" onClick={() => setMediaOpen(true)}>Media</Button>
              </div>
            </div>
            <div><Label>Link</Label><Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://" /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_featured} onCheckedChange={(c) => setForm({ ...form, is_featured: c })} /><Label>Featured</Label></div>
            <Button type="submit" className="w-full" disabled={upsert.isPending}>{editing ? 'Update' : 'Create'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <MediaPickerModal open={mediaOpen} onClose={() => setMediaOpen(false)} onSelect={(url) => { setForm({ ...form, image_url: url }); setMediaOpen(false); }} />
    </div>
  );
};

export default AdminEvents;
