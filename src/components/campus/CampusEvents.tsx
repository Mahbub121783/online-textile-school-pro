import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarDays, Loader2, Trash2, EyeOff, Eye, Plus, MapPin } from 'lucide-react';

interface CampusEventsProps {
  campusId: string;
  /** 'manage' = full CRUD (campus owner or admin). 'public' = read-only, active events only. */
  mode: 'manage' | 'public';
}

/**
 * Campus events & calendar -- new feature (db/62). Same manage/public dual-
 * mode shape as NoticeBoard.tsx, split into Upcoming/Past sections by
 * event_date.
 */
const CampusEvents = ({ campusId, mode }: CampusEventsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['campus-events', campusId, mode],
    enabled: !!campusId,
    refetchInterval: 45000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      let query = supabase.from('campus_events').select('*').eq('campus_id', campusId).order('event_date', { ascending: true });
      if (mode === 'public') query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const now = Date.now();
  const upcoming = events.filter((e: any) => new Date(e.event_date).getTime() >= now);
  const past = events.filter((e: any) => new Date(e.event_date).getTime() < now).reverse();

  const resetForm = () => { setTitle(''); setDescription(''); setEventDate(''); setLocation(''); setAdding(false); };

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('campus_events').insert({
        campus_id: campusId, title: title.trim(), description: description.trim() || null,
        event_date: new Date(eventDate).toISOString(), location: location.trim() || null, posted_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campus-events', campusId] });
      toast.success('Event posted');
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('campus_events').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campus-events', campusId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campus_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campus-events', campusId] });
      toast.success('Event removed');
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (mode === 'public' && !isLoading && events.length === 0) return null;

  const EventRow = ({ e }: { e: any }) => (
    <div className={`border rounded-lg p-3 ${e.is_active ? 'bg-card' : 'bg-muted/30 opacity-70'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
            {e.title}
            {mode === 'manage' && !e.is_active && <Badge variant="outline" className="text-[10px]">Hidden</Badge>}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {format(new Date(e.event_date), 'dd MMM yyyy, hh:mm a')}</p>
          {e.location && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.location}</p>}
          {e.description && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{e.description}</p>}
        </div>
        {mode === 'manage' && (
          <div className="flex gap-1 shrink-0">
            <Button
              type="button" size="icon" variant="ghost" className="h-7 w-7"
              onClick={() => toggleMutation.mutate({ id: e.id, is_active: !e.is_active })}
              disabled={toggleMutation.isPending}
              title={e.is_active ? 'Hide from public' : 'Show to public'}
            >
              {e.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => { if (confirm('Delete this event?')) deleteMutation.mutate(e.id); }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Events</h3>
        {mode === 'manage' && (
          <Button type="button" size="sm" variant="outline" onClick={() => setAdding((a) => !a)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Event
          </Button>
        )}
      </div>

      {mode === 'manage' && adding && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
          <Input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          <Input placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
          <Textarea placeholder="Event details..." rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
            <Button
              type="button" size="sm"
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !title.trim() || !eventDate}
            >
              {addMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Post Event
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
      ) : events.length === 0 ? (
        mode === 'manage' && <p className="text-xs text-muted-foreground">No events posted yet.</p>
      ) : (
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Upcoming</p>
              {upcoming.map((e: any) => <EventRow key={e.id} e={e} />)}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Past</p>
              {past.map((e: any) => <EventRow key={e.id} e={e} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CampusEvents;
