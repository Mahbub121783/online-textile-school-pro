import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Save, GraduationCap } from 'lucide-react';

const AdminGradeConfig = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ letter_grade: '', min_pct: '', max_pct: '', grade_point: '', is_active: true, sort_order: '0' });
  const [tab, setTab] = useState('config');

  // Grade Config
  const { data: gradeConfigs = [] } = useQuery({
    queryKey: ['grade-configs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('grade_configs' as any).select('*').order('sort_order');
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Student Grades with joins
  const { data: studentGrades = [] } = useQuery({
    queryKey: ['student-grades-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('student_grades' as any)
        .select('*, user_profiles:user_id(full_name, roll_id), courses:course_id(title), batches:batch_id(name)')
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: tab === 'grades',
  });

  // Courses for grade assignment
  const { data: courses = [] } = useQuery({
    queryKey: ['courses-for-grades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('courses').select('id, title').eq('is_published', true).order('title');
      if (error) throw error;
      return data || [];
    },
    enabled: tab === 'assign',
  });

  const [assignForm, setAssignForm] = useState({ user_search: '', course_id: '', letter_grade: '', semester: '', credits: '3', notes: '' });
  const [assignResults, setAssignResults] = useState<any[]>([]);

  const searchStudentsForGrade = async (q: string) => {
    if (q.length < 2) { setAssignResults([]); return; }
    const { data, error } = await supabase.from('user_profiles').select('id, full_name, roll_id').or(`full_name.ilike.%${q}%,roll_id.ilike.%${q}%`).limit(10);
    if (error) { toast.error(error.message); return; }
    setAssignResults(data || []);
  };

  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const saveConfig = useMutation({
    mutationFn: async () => {
      const payload = {
        letter_grade: form.letter_grade,
        min_pct: parseFloat(form.min_pct),
        max_pct: parseFloat(form.max_pct),
        grade_point: parseFloat(form.grade_point),
        is_active: form.is_active,
        sort_order: parseInt(form.sort_order),
      };
      if (editItem) {
        const { error } = await supabase.from('grade_configs' as any).update(payload).eq('id', editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('grade_configs' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grade-configs'] });
      toast.success('Grade config saved');
      setShowForm(false); setEditItem(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteConfig = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('grade_configs' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['grade-configs'] }); toast.success('Deleted'); },
  });

  const assignGrade = useMutation({
    mutationFn: async () => {
      if (!selectedStudent || !assignForm.course_id || !assignForm.letter_grade) throw new Error('Fill all required fields');
      const config = gradeConfigs.find((g: any) => g.letter_grade === assignForm.letter_grade);
      const { error } = await supabase.from('student_grades' as any).upsert({
        user_id: selectedStudent.id,
        course_id: assignForm.course_id,
        letter_grade: assignForm.letter_grade,
        grade_point: config?.grade_point || 0,
        credits: parseFloat(assignForm.credits),
        semester: assignForm.semester || null,
        notes: assignForm.notes || null,
      }, { onConflict: 'user_id,course_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-grades-admin'] });
      toast.success('Grade assigned');
      setSelectedStudent(null);
      setAssignForm({ user_search: '', course_id: '', letter_grade: '', semester: '', credits: '3', notes: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEditConfig = (c: any) => {
    setEditItem(c);
    setForm({ letter_grade: c.letter_grade, min_pct: c.min_pct.toString(), max_pct: c.max_pct.toString(), grade_point: c.grade_point.toString(), is_active: c.is_active, sort_order: c.sort_order.toString() });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">Grade Point System (GPA/CGPA)</h2>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="config">Grading Scale</TabsTrigger>
          <TabsTrigger value="grades">Student Grades</TabsTrigger>
          <TabsTrigger value="assign">Assign Grade</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditItem(null); setForm({ letter_grade: '', min_pct: '', max_pct: '', grade_point: '', is_active: true, sort_order: '0' }); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Add Grade
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grade</TableHead>
                  <TableHead>Min %</TableHead>
                  <TableHead>Max %</TableHead>
                  <TableHead>Point</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradeConfigs.map((g: any) => (
                  <TableRow key={g.id}>
                    <TableCell><Badge variant="outline" className="font-bold">{g.letter_grade}</Badge></TableCell>
                    <TableCell>{g.min_pct}%</TableCell>
                    <TableCell>{g.max_pct}%</TableCell>
                    <TableCell className="font-semibold">{g.grade_point}</TableCell>
                    <TableCell>{g.is_active ? '✓' : '—'}</TableCell>
                    <TableCell className="space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditConfig(g)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteConfig.mutate(g.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="grades" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Roll ID</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>GPA</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Semester</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentGrades.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No grades recorded</TableCell></TableRow>
                ) : studentGrades.map((g: any) => (
                  <TableRow key={g.id}>
                    <TableCell>{g.user_profiles?.full_name || 'N/A'}</TableCell>
                    <TableCell>{g.user_profiles?.roll_id || '-'}</TableCell>
                    <TableCell>{g.courses?.title || '-'}</TableCell>
                    <TableCell><Badge>{g.letter_grade}</Badge></TableCell>
                    <TableCell className="font-semibold">{g.grade_point}</TableCell>
                    <TableCell>{g.credits}</TableCell>
                    <TableCell>{g.semester || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="assign" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Assign Grade to Student</CardTitle><CardDescription>Search for a student, select course, and assign grade</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Search Student *</Label>
                <Input value={assignForm.user_search} onChange={e => { setAssignForm({ ...assignForm, user_search: e.target.value }); searchStudentsForGrade(e.target.value); }} placeholder="Name or Roll ID..." />
                {assignResults.length > 0 && !selectedStudent && (
                  <div className="mt-1 border rounded-md max-h-32 overflow-auto">
                    {assignResults.map(s => (
                      <div key={s.id} className="p-2 hover:bg-muted/50 cursor-pointer text-sm" onClick={() => { setSelectedStudent(s); setAssignForm({ ...assignForm, user_search: s.full_name }); setAssignResults([]); }}>
                        {s.full_name} ({s.roll_id})
                      </div>
                    ))}
                  </div>
                )}
                {selectedStudent && <Badge className="mt-1">{selectedStudent.full_name} - {selectedStudent.roll_id}</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Course *</Label>
                  <Select value={assignForm.course_id} onValueChange={v => setAssignForm({ ...assignForm, course_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>{courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Letter Grade *</Label>
                  <Select value={assignForm.letter_grade} onValueChange={v => setAssignForm({ ...assignForm, letter_grade: v })}>
                    <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                    <SelectContent>{gradeConfigs.filter((g: any) => g.is_active).map((g: any) => <SelectItem key={g.id} value={g.letter_grade}>{g.letter_grade} ({g.grade_point})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Semester</Label><Input value={assignForm.semester} onChange={e => setAssignForm({ ...assignForm, semester: e.target.value })} placeholder="Fall 2025" /></div>
                <div><Label>Credits</Label><Input type="number" value={assignForm.credits} onChange={e => setAssignForm({ ...assignForm, credits: e.target.value })} /></div>
                <div><Label>Notes</Label><Input value={assignForm.notes} onChange={e => setAssignForm({ ...assignForm, notes: e.target.value })} /></div>
              </div>
              <Button onClick={() => assignGrade.mutate()} disabled={assignGrade.isPending} className="w-full">
                <GraduationCap className="h-4 w-4 mr-2" /> {assignGrade.isPending ? 'Assigning...' : 'Assign Grade'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Edit Grade' : 'Add Grade Level'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Letter Grade *</Label><Input value={form.letter_grade} onChange={e => setForm({ ...form, letter_grade: e.target.value })} placeholder="A+" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Min Percentage *</Label><Input type="number" value={form.min_pct} onChange={e => setForm({ ...form, min_pct: e.target.value })} /></div>
              <div><Label>Max Percentage *</Label><Input type="number" value={form.max_pct} onChange={e => setForm({ ...form, max_pct: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Grade Point *</Label><Input type="number" step="0.01" value={form.grade_point} onChange={e => setForm({ ...form, grade_point: e.target.value })} /></div>
              <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
            <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending} className="w-full">
              {saveConfig.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminGradeConfig;
