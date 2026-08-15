import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Users, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const statusIcon: Record<string, React.ReactNode> = {
  present: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  absent: <XCircle className="h-4 w-4 text-destructive" />,
  late: <Clock className="h-4 w-4 text-warning" />,
  excused: <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
};

const AdminAttendance = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState<string>('');

  const { data: liveClasses = [] } = useQuery({
    queryKey: ['live-classes-for-attendance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_classes')
        .select('id, title, start_time, course_id, courses(title)')
        .order('start_time', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: attendanceRecords = [], isLoading } = useQuery({
    queryKey: ['attendance-records', selectedClass],
    enabled: !!selectedClass,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*, user_profiles:user_id(full_name, avatar_url, roll_id)')
        .eq('live_class_id', selectedClass)
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Get enrolled students for the selected class's course
  const selectedLiveClass = liveClasses.find((c: any) => c.id === selectedClass);
  const { data: enrolledStudents = [] } = useQuery({
    queryKey: ['enrolled-students-attendance', selectedLiveClass?.course_id],
    enabled: !!selectedLiveClass?.course_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('enrollments')
        .select('user_id, user_profiles:user_id(id, full_name, roll_id)')
        .eq('course_id', selectedLiveClass!.course_id);
      return data ?? [];
    },
  });

  const markAttendance = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const { error } = await supabase.from('attendance_records').upsert({
        live_class_id: selectedClass,
        user_id: userId,
        status,
        marked_by: user!.id,
        check_in_time: status === 'present' || status === 'late' ? new Date().toISOString() : null,
      }, { onConflict: 'live_class_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-records', selectedClass] });
      toast.success('Attendance updated');
    },
  });

  const bulkMarkAll = async (status: string) => {
    const students = enrolledStudents.map((e: any) => e.user_id);
    if (!students.length) return;
    const rows = students.map((uid: string) => ({
      live_class_id: selectedClass,
      user_id: uid,
      status,
      marked_by: user!.id,
      check_in_time: status === 'present' ? new Date().toISOString() : null,
    }));
    const { error } = await supabase.from('attendance_records').upsert(rows, { onConflict: 'live_class_id,user_id' });
    if (error) toast.error(error.message);
    else {
      queryClient.invalidateQueries({ queryKey: ['attendance-records', selectedClass] });
      toast.success(`All marked as ${status}`);
    }
  };

  // Merge enrolled students with attendance
  const attendanceMap = new Map(attendanceRecords.map((a: any) => [a.user_id, a]));
  const mergedStudents = enrolledStudents.map((e: any) => {
    const record = attendanceMap.get(e.user_id);
    return {
      user_id: e.user_id,
      full_name: (e.user_profiles as any)?.full_name || 'Student',
      roll_id: (e.user_profiles as any)?.roll_id || '',
      status: record?.status || 'unmarked',
      check_in_time: record?.check_in_time,
    };
  });

  // Stats
  const presentCount = mergedStudents.filter(s => s.status === 'present').length;
  const absentCount = mergedStudents.filter(s => s.status === 'absent').length;
  const lateCount = mergedStudents.filter(s => s.status === 'late').length;

  const exportCSV = () => {
    const headers = 'Name,Roll ID,Status,Check-in Time\n';
    const rows = mergedStudents.map(s =>
      `"${s.full_name}","${s.roll_id}","${s.status}","${s.check_in_time ? format(new Date(s.check_in_time), 'PPP p') : ''}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${selectedClass}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Attendance Management</h1>
        <p className="text-sm text-muted-foreground">Mark and track attendance for live classes</p>
      </div>

      <div className="max-w-md">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger><SelectValue placeholder="Select a live class..." /></SelectTrigger>
          <SelectContent>
            {liveClasses.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title} — {format(new Date(c.start_time), 'MMM dd, yyyy')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedClass && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{mergedStudents.length}</p><p className="text-[10px] text-muted-foreground">Total</p></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-green-600">{presentCount}</p><p className="text-[10px] text-muted-foreground">Present</p></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-destructive">{absentCount}</p><p className="text-[10px] text-muted-foreground">Absent</p></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-warning">{lateCount}</p><p className="text-[10px] text-muted-foreground">Late</p></CardContent></Card>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => bulkMarkAll('present')} className="text-xs gap-1">
              <CheckCircle2 className="h-3 w-3" /> Mark All Present
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkMarkAll('absent')} className="text-xs gap-1">
              <XCircle className="h-3 w-3" /> Mark All Absent
            </Button>
            <Button size="sm" variant="outline" onClick={exportCSV} className="text-xs gap-1 ml-auto">
              <Download className="h-3 w-3" /> Export CSV
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Roll ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mergedStudents.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No enrolled students found for this class's course.</TableCell></TableRow>
                  ) : (
                    mergedStudents.map((student) => (
                      <TableRow key={student.user_id}>
                        <TableCell className="font-medium text-sm">{student.full_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{student.roll_id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {statusIcon[student.status] || <span className="text-xs text-muted-foreground">—</span>}
                            <span className="text-xs capitalize">{student.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {student.check_in_time ? format(new Date(student.check_in_time), 'p') : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {(['present', 'absent', 'late', 'excused'] as const).map(s => (
                              <Button
                                key={s}
                                size="sm"
                                variant={student.status === s ? 'default' : 'ghost'}
                                className="text-[10px] h-7 px-2 capitalize"
                                onClick={() => markAttendance.mutate({ userId: student.user_id, status: s })}
                                disabled={markAttendance.isPending}
                              >
                                {s === 'present' ? 'P' : s === 'absent' ? 'A' : s === 'late' ? 'L' : 'E'}
                              </Button>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminAttendance;
