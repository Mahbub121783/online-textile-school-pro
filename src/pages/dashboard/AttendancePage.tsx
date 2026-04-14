import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarCheck, CheckCircle2, XCircle, Clock, AlertTriangle, Flame, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  present: { label: 'Present', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  absent: { label: 'Absent', color: 'bg-red-100 text-red-800', icon: XCircle },
  late: { label: 'Late', color: 'bg-amber-100 text-amber-800', icon: Clock },
  excused: { label: 'Excused', color: 'bg-blue-100 text-blue-800', icon: AlertTriangle },
};

type DateRange = 'week' | 'month' | 'all';

const AttendancePage = () => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['my-attendance', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('attendance_records')
        .select('*, live_classes(title, course_id, scheduled_at, courses:course_id(title))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  // Extract unique courses
  const courses = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((r: any) => {
      const cId = r.live_classes?.course_id;
      const cTitle = r.live_classes?.courses?.title;
      if (cId && cTitle) map.set(cId, cTitle);
    });
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [records]);

  // Filter by date range and course
  const filtered = useMemo(() => {
    let data = records;
    if (courseFilter !== 'all') {
      data = data.filter((r: any) => r.live_classes?.course_id === courseFilter);
    }
    if (dateRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      if (dateRange === 'week') cutoff.setDate(now.getDate() - 7);
      else cutoff.setDate(now.getDate() - 30);
      data = data.filter((r: any) => new Date(r.created_at) >= cutoff);
    }
    return data;
  }, [records, dateRange, courseFilter]);

  const total = filtered.length;
  const presentCount = filtered.filter((r: any) => r.status === 'present').length;
  const lateCount = filtered.filter((r: any) => r.status === 'late').length;
  const absentCount = filtered.filter((r: any) => r.status === 'absent').length;
  const excusedCount = filtered.filter((r: any) => r.status === 'excused').length;
  const attendanceRate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;

  // Streak calculation (consecutive present/late days, most recent first)
  const streak = useMemo(() => {
    let count = 0;
    const sorted = [...filtered].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    for (const r of sorted) {
      if (r.status === 'present' || r.status === 'late') count++;
      else break;
    }
    return count;
  }, [filtered]);

  // Weekly trend chart data
  const chartData = useMemo(() => {
    const weeks = new Map<string, { present: number; absent: number; week: string }>();
    filtered.forEach((r: any) => {
      const d = new Date(r.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      const label = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (!weeks.has(key)) weeks.set(key, { present: 0, absent: 0, week: label });
      const entry = weeks.get(key)!;
      if (r.status === 'present' || r.status === 'late') entry.present++;
      else entry.absent++;
    });
    return Array.from(weeks.values()).sort((a, b) => a.week.localeCompare(b.week)).slice(-8);
  }, [filtered]);

  // Per-course breakdown
  const courseMap: Record<string, { title: string; records: any[] }> = {};
  filtered.forEach((r: any) => {
    const courseTitle = r.live_classes?.courses?.title || 'Unknown Course';
    const courseId = r.live_classes?.course_id || 'unknown';
    if (!courseMap[courseId]) courseMap[courseId] = { title: courseTitle, records: [] };
    courseMap[courseId].records.push(r);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <CalendarCheck className="h-6 w-6" /> My Attendance
          </h1>
          <p className="text-sm text-muted-foreground">Track your attendance across all live classes</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All Courses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-6">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-primary">{attendanceRate}%</p>
            <p className="text-xs text-muted-foreground">Attendance Rate</p>
            <Progress value={attendanceRate} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">{presentCount}</p>
            <p className="text-xs text-muted-foreground">Present</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{lateCount}</p>
            <p className="text-xs text-muted-foreground">Late</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-red-600">{absentCount}</p>
            <p className="text-xs text-muted-foreground">Absent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{excusedCount}</p>
            <p className="text-xs text-muted-foreground">Excused</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Flame className="h-5 w-5 text-orange-500" />
              <p className="text-2xl font-bold text-orange-500">{streak}</p>
            </div>
            <p className="text-xs text-muted-foreground">Streak</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Weekly Attendance Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip />
                <Bar dataKey="present" name="Present" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" name="Absent" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-Course Breakdown */}
      {Object.keys(courseMap).length > 0 && (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">By Course</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(courseMap).map(([courseId, { title, records: courseRecords }]) => {
              const cPresent = courseRecords.filter((r: any) => r.status === 'present' || r.status === 'late').length;
              const cRate = Math.round((cPresent / courseRecords.length) * 100);
              return (
                <Card key={courseId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Progress value={cRate} className="flex-1 h-2" />
                      <span className="text-sm font-semibold">{cRate}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{courseRecords.length} classes</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attendance History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground animate-pulse">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No attendance records found.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-auto">
              {filtered.map((r: any) => {
                const cfg = statusConfig[r.status] || statusConfig.absent;
                const Icon = cfg.icon;
                return (
                  <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{r.live_classes?.title || 'Live Class'}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.live_classes?.courses?.title} • {r.live_classes?.scheduled_at ? new Date(r.live_classes.scheduled_at).toLocaleDateString() : r.created_at?.split('T')[0]}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.check_in_time && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendancePage;
