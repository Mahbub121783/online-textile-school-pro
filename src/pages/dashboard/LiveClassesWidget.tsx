import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Video, Calendar, Clock, ExternalLink } from 'lucide-react';
import { format, isWithinInterval, addMinutes, subMinutes } from 'date-fns';

const LiveClassesWidget = () => {
  const { user } = useAuth();

  // Fetch upcoming live classes for enrolled courses
  const { data: upcomingClasses = [] } = useQuery({
    queryKey: ['student-upcoming-classes', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Get enrolled course ids
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('user_id', user!.id);
      if (!enrollments?.length) return [];
      const courseIds = enrollments.map(e => e.course_id);

      const { data } = await supabase
        .from('live_classes')
        .select('*, courses(title)')
        .in('course_id', courseIds)
        .in('status', ['scheduled', 'live'])
        .gte('start_time', new Date().toISOString())
        .order('start_time')
        .limit(5);
      return data ?? [];
    },
  });

  // Student attendance stats
  const { data: attendanceStats } = useQuery({
    queryKey: ['student-attendance-stats', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('user_id', user!.id);
      if (!data?.length) return { total: 0, present: 0, pct: 0 };
      const present = data.filter(r => r.status === 'present' || r.status === 'late').length;
      return { total: data.length, present, pct: Math.round((present / data.length) * 100) };
    },
  });

  const now = new Date();

  return (
    <div className="space-y-4">
      {/* Attendance summary */}
      {attendanceStats && attendanceStats.total > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Attendance Rate</p>
                <p className="text-2xl font-bold">{attendanceStats.pct}%</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>{attendanceStats.present} / {attendanceStats.total} classes attended</p>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${attendanceStats.pct >= 75 ? 'bg-green-500' : attendanceStats.pct >= 50 ? 'bg-warning' : 'bg-destructive'}`}
                style={{ width: `${attendanceStats.pct}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming classes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" /> Upcoming Live Classes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcomingClasses.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No upcoming live classes</p>
          ) : (
            upcomingClasses.map((cls: any) => {
              const startTime = new Date(cls.start_time);
              const endTime = addMinutes(startTime, cls.duration_minutes);
              const canJoin = isWithinInterval(now, { start: subMinutes(startTime, 10), end: endTime });
              const isLive = cls.status === 'live' || isWithinInterval(now, { start: startTime, end: endTime });

              return (
                <div key={cls.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{cls.title}</p>
                      {isLive && <Badge className="bg-green-500 text-white text-[10px] animate-pulse">LIVE</Badge>}
                      <Badge variant="outline" className="text-[10px]">{cls.platform}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Calendar className="h-3 w-3" />{format(startTime, 'MMM dd')}</span>
                      <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{format(startTime, 'p')} • {cls.duration_minutes}m</span>
                    </div>
                    {cls.courses?.title && <p className="text-[10px] text-muted-foreground mt-0.5">{cls.courses.title}</p>}
                  </div>
                  {cls.meeting_url && canJoin && (
                    <a href={cls.meeting_url} target="_blank" rel="noreferrer">
                      <Button size="sm" className="text-xs gap-1 shrink-0">
                        <ExternalLink className="h-3 w-3" /> Join
                      </Button>
                    </a>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveClassesWidget;
