import { TableSkeleton } from '@/components/ui/loading-skeletons';
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
import { toast } from 'sonner';
import { Plus, Users, Edit, Trash2, UserPlus, BookOpen } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface Batch {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  max_students: number | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  upcoming: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  archived: 'bg-yellow-100 text-yellow-800',
};

const AdminBatches = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showAssign, setShowAssign] = useState<string | null>(null);
  const [showCourses, setShowCourses] = useState<string | null>(null);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [form, setForm] = useState({ name: '', description: '', start_date: '', end_date: '', status: 'upcoming', max_students: '' });
  const [searchStudent, setSearchStudent] = useState('');

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['admin-batches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('batches' as any).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Batch[];
    },
  });

  const { data: batchStudentCounts = {} } = useQuery({
    queryKey: ['batch-student-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('batch_students' as any).select('batch_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => { counts[r.batch_id] = (counts[r.batch_id] || 0) + 1; });
      return counts;
    },
  });

  const { data: batchStudents = [] } = useQuery({
    queryKey: ['batch-students', showAssign],
    queryFn: async () => {
      if (!showAssign) return [];
      const { data, error } = await supabase.from('batch_students' as any).select('*, user_profiles:user_id(id, full_name, roll_id, avatar_url)').eq('batch_id', showAssign);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!showAssign,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ['student-search', searchStudent],
    queryFn: async () => {
      if (searchStudent.length < 2) return [];
      const { data, error } = await supabase.from('user_profiles').select('id, full_name, roll_id, avatar_url').or(`full_name.ilike.%${searchStudent}%,roll_id.ilike.%${searchStudent}%`).limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: searchStudent.length >= 2,
  });

  // All courses for batch-course linking
  const { data: allCourses = [] } = useQuery({
    queryKey: ['all-courses-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('courses').select('id, title').order('title');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Courses assigned to the selected batch
  const { data: batchCourses = [] } = useQuery({
    queryKey: ['batch-courses', showCourses],
    queryFn: async () => {
      if (!showCourses) return [];
      const { data, error } = await supabase.from('batch_courses' as any).select('*, courses:course_id(id, title)').eq('batch_id', showCourses);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!showCourses,
  });

  const saveBatch = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        status: form.status,
        max_students: form.max_students ? parseInt(form.max_students) : null,
      };
      if (editBatch) {
        const { error } = await supabase.from('batches' as any).update(payload).eq('id', editBatch.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('batches' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batches'] });
      toast.success(editBatch ? 'Batch updated' : 'Batch created');
      setShowForm(false);
      setEditBatch(null);
      setForm({ name: '', description: '', start_date: '', end_date: '', status: 'upcoming', max_students: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteBatch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('batches' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batches'] });
      toast.success('Batch deleted');
    },
  });

  const assignStudent = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('batch_students' as any).insert({ batch_id: showAssign, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-students', showAssign] });
      queryClient.invalidateQueries({ queryKey: ['batch-student-counts'] });
      toast.success('Student assigned');
      setSearchStudent('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeStudent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('batch_students' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-students', showAssign] });
      queryClient.invalidateQueries({ queryKey: ['batch-student-counts'] });
      toast.success('Student removed');
    },
  });

  const toggleBatchCourse = useMutation({
    mutationFn: async ({ courseId, assigned }: { courseId: string; assigned: boolean }) => {
      if (assigned) {
        const { error } = await supabase.from('batch_courses' as any).delete().eq('batch_id', showCourses).eq('course_id', courseId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('batch_courses' as any).insert({ batch_id: showCourses, course_id: courseId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-courses', showCourses] });
      toast.success('Batch courses updated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (b: Batch) => {
    setEditBatch(b);
    setForm({ name: b.name, description: b.description || '', start_date: b.start_date, end_date: b.end_date || '', status: b.status, max_students: b.max_students?.toString() || '' });
    setShowForm(true);
  };

  const assignedCourseIds = batchCourses.map((bc: any) => bc.course_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">Batch / Cohort Management</h2>
        <Button onClick={() => { setEditBatch(null); setForm({ name: '', description: '', start_date: '', end_date: '', status: 'upcoming', max_students: '' }); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Batch
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Batches</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{batches.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{batches.filter(b => b.status === 'active').length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Upcoming</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-blue-600">{batches.filter(b => b.status === 'upcoming').length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Students</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{Object.values(batchStudentCounts).reduce((a: number, b: number) => a + b, 0)}</p></CardContent></Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editBatch ? 'Edit Batch' : 'Create New Batch'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Batch 2025-A" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date *</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Max Students</Label><Input type="number" value={form.max_students} onChange={e => setForm({ ...form, max_students: e.target.value })} /></div>
            </div>
            <Button onClick={() => saveBatch.mutate()} disabled={!form.name || !form.start_date || saveBatch.isPending} className="w-full">
              {saveBatch.isPending ? 'Saving...' : editBatch ? 'Update Batch' : 'Create Batch'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Students Dialog */}
      <Dialog open={!!showAssign} onOpenChange={() => setShowAssign(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Manage Students - {batches.find(b => b.id === showAssign)?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Search & Add Student</Label>
              <Input value={searchStudent} onChange={e => setSearchStudent(e.target.value)} placeholder="Search by name or roll ID..." />
              {searchResults.length > 0 && (
                <div className="mt-2 border rounded-md max-h-40 overflow-auto">
                  {searchResults.filter(s => !batchStudents.some((bs: any) => bs.user_id === s.id)).map(s => (
                    <div key={s.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer" onClick={() => assignStudent.mutate(s.id)}>
                      <span className="text-sm">{s.full_name} ({s.roll_id})</span>
                      <UserPlus className="h-4 w-4 text-primary" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Roll ID</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {batchStudents.map((bs: any) => (
                  <TableRow key={bs.id}>
                    <TableCell>{bs.user_profiles?.full_name || 'N/A'}</TableCell>
                    <TableCell>{bs.user_profiles?.roll_id || '-'}</TableCell>
                    <TableCell><Badge variant="outline">{bs.status}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={() => removeStudent.mutate(bs.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {batchStudents.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No students assigned</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Courses Dialog */}
      <Dialog open={!!showCourses} onOpenChange={() => setShowCourses(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Assign Courses — {batches.find(b => b.id === showCourses)?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-96 overflow-auto">
            {allCourses.map((c: any) => {
              const isAssigned = assignedCourseIds.includes(c.id);
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleBatchCourse.mutate({ courseId: c.id, assigned: isAssigned })}
                >
                  <Checkbox checked={isAssigned} />
                  <span className="text-sm">{c.title}</span>
                </div>
              );
            })}
            {allCourses.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No courses found</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch List */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton rows={5} columns={6} />
            ) : batches.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No batches yet</TableCell></TableRow>
            ) : batches.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell><Badge className={statusColors[b.status]}>{b.status}</Badge></TableCell>
                <TableCell>{b.start_date}</TableCell>
                <TableCell>{b.end_date || '-'}</TableCell>
                <TableCell>{(batchStudentCounts as any)[b.id] || 0}{b.max_students ? `/${b.max_students}` : ''}</TableCell>
                <TableCell className="space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => setShowCourses(b.id)} title="Assign Courses"><BookOpen className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAssign(b.id)}><Users className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(b)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteBatch.mutate(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default AdminBatches;
