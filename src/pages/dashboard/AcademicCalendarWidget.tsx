import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';

const typeColors: Record<string, string> = {
  semester_start: 'bg-green-100 text-green-800',
  semester_end: 'bg-red-100 text-red-800',
  exam_week: 'bg-amber-100 text-amber-800',
  holiday: 'bg-purple-100 text-purple-800',
  deadline: 'bg-pink-100 text-pink-800',
  registration: 'bg-cyan-100 text-cyan-800',
  other: 'bg-blue-100 text-blue-800',
};

const AcademicCalendarWidget = () => {
  const { user } = useAuth();

  // Get student's batch IDs
  const { data: myBatchIds = [] } = useQuery({
    queryKey: ['my-batch-ids', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('batch_students')
        .select('batch_id')
        .eq('user_id', user.id);
      return (data || []).map((r: any) => r.batch_id);
    },
    enabled: !!user,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['academic-calendar-widget', myBatchIds],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      let query = supabase.from('academic_calendar' as any)
        .select('*')
        .gte('start_date', today)
        .order('start_date')
        .limit(10);

      const { data } = await query;
      const allEvents = (data || []) as any[];

      // Filter: show global events + events matching student's batches
      if (myBatchIds.length > 0) {
        return allEvents.filter((e: any) =>
          e.is_global || !e.batch_id || myBatchIds.includes(e.batch_id)
        ).slice(0, 5);
      }
      // If no batches, show global only
      return allEvents.filter((e: any) => e.is_global || !e.batch_id).slice(0, 5);
    },
  });

  if (events.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Upcoming Academic Events
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.map((e: any) => (
          <div key={e.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
            <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: e.color || '#3b82f6' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{e.title}</p>
              <p className="text-xs text-muted-foreground">{e.start_date}{e.end_date ? ` — ${e.end_date}` : ''}</p>
            </div>
            <Badge className={`text-[10px] ${typeColors[e.event_type] || typeColors.other}`}>{e.event_type.replace('_', ' ')}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AcademicCalendarWidget;
