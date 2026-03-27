import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Search, Plus, Pencil, Trash2, CheckCircle2, Clock, FileText } from 'lucide-react';
import { format } from 'date-fns';

const AssignmentTab = () => {
  const [subTab, setSubTab] = useState('assignments');
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [editDialog, setEditDialog] = useState<{ open: boolean; assignment?: any }>({ open: false });
  const [gradeDialog, setGradeDialog] = useState<{ open: boolean; submission?: any }>({ open: false });
  const [form, setForm] = useState({ title: '', course_id: '', description: '', instructions: '', max_score: '100', due_days: '7', is_published: false });
  const [gradeForm, setGradeForm] = useState({ score: '', feedback: '' });
  const qc = useQueryClient();

  const { data: courses = [] } = useQuery({
    queryKey: ['assignment-mgmt-courses'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').order('title');
      return data ?? [];
    },
  });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['admin-assignments', courseFilter, search],
    queryFn: async () => {
      let q = supabase.from('assignments').select('*, courses!assignments_course_id_fkey(title)').order('created_at', { ascending: false });
      if (courseFilter !== 'all') q = q.eq('course_id', courseFilter);
      if (search) q = q.ilike('title', `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['admin-submissions', courseFilter, search],
    enabled: subTab === 'submissions',
    queryFn: async () => {
      let q = supabase.from('assignment_submissions').select('*, assignments!assignment_submissions_assignment_id_fkey(title, course_id, max_score, courses!assignments_course_id_fkey(title)), user_profiles!assignment_submissions_user_id_fkey(full_name)').order('submitted_at', { ascending: false }).limit(100);
      const { data } = await q;
      let results = data ?? [];
      if (courseFilter !== 'all') results = results.filter((s: any) => s.assignments?.course_id === courseFilter);
      if (search) results = results.filter((s: any) => s.user_profiles?.full_name?.toLowerCase().includes(search.toLowerCase()));
      return results;
    },
  });

  const saveAssignment = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from('assignments').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('assignments').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-assignments'] }); setEditDialog({ open: false }); toast.success('Assignment saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  const gradeSubmission = useMutation({
    mutationFn: async ({ id, score, feedback }: { id: string; score: number; feedback: string }) => {
      const { error } = await supabase.from('assignment_submissions').update({ score, feedback, status: 'graded', graded_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-submissions'] }); setGradeDialog({ open: false }); toast.success('Graded successfully'); },
  });

  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-assignments'] }); toast.success('Assignment deleted'); },
  });

  const openEdit = (a?: any) => {
    if (a) {
      setForm({ title: a.title, course_id: a.course_id, description: a.description || '', instructions: a.instructions || '', max_score: String(a.max_score || 100), due_days: String(a.due_days || 7), is_published: a.is_published ?? false });
    } else {
      setForm({ title: '', course_id: '', description: '', instructions: '', max_score: '100', due_days: '7', is_published: false });
    }
    setEditDialog({ open: true, assignment: a });
  };

  const handleSave = () => {
    if (!form.title.trim()) return toast.error('Title is required');
    const payload: any = { title: form.title, course_id: form.course_id || null, description: form.description, instructions: form.instructions, max_score: parseInt(form.max_score) || 100, due_days: parseInt(form.due_days) || 7, is_published: form.is_published };
    if (editDialog.assignment) payload.id = editDialog.assignment.id;
    saveAssignment.mutate(payload);
  };

  const openGrade = (sub: any) => {
    setGradeForm({ score: String(sub.score ?? ''), feedback: sub.feedback || '' });
    setGradeDialog({ open: true, submission: sub });
  };

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="assignments">Assignment Maker</TabsTrigger>
          <TabsTrigger value="submissions">Submissions & Grading</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-48 h-9"><SelectValue placeholder="All Courses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        {subTab === 'assignments' && (
          <Button size="sm" className="gap-1 bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => openEdit()}>
            <Plus className="h-4 w-4" /> New Assignment
          </Button>
        )}
      </div>

      {subTab === 'assignments' ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Max Score</TableHead>
                  <TableHead>Due Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : assignments.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No assignments found.</TableCell></TableRow>
                ) : assignments.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-sm">{a.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">{a.courses?.title || <Badge variant="outline" className="text-[10px]">Independent</Badge>}</TableCell>
                    <TableCell className="text-sm">{a.max_score}</TableCell>
                    <TableCell className="text-sm">{a.due_days}d</TableCell>
                    <TableCell>
                      <Badge variant={a.is_published ? 'default' : 'outline'} className="text-xs">
                        {a.is_published ? 'Published' : 'Draft'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAssignment.mutate(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No submissions yet.</TableCell></TableRow>
                ) : submissions.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-sm">{s.user_profiles?.full_name || 'Unknown'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.assignments?.title || '—'}</TableCell>
                    <TableCell className="text-sm">{s.score != null ? `${s.score}/${s.assignments?.max_score || 100}` : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'graded' ? 'default' : 'secondary'} className="text-xs gap-1">
                        {s.status === 'graded' ? <><CheckCircle2 className="h-3 w-3" /> Graded</> : <><Clock className="h-3 w-3" /> {s.status}</>}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.submitted_at ? format(new Date(s.submitted_at), 'MMM d, HH:mm') : '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openGrade(s)}>
                        {s.status === 'graded' ? 'Re-grade' : 'Grade'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Assignment Dialog */}
      <Dialog open={editDialog.open} onOpenChange={o => setEditDialog({ ...editDialog, open: o })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editDialog.assignment ? 'Edit Assignment' : 'New Assignment'}</DialogTitle>
            <DialogDescription>Configure assignment details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Course</Label>
              <Select value={form.course_id || '_independent'} onValueChange={v => setForm(f => ({ ...f, course_id: v === '_independent' ? '' : v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_independent">Independent (No Course)</SelectItem>
                  {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Instructions</Label>
              <Textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Max Score</Label>
                <Input type="number" value={form.max_score} onChange={e => setForm(f => ({ ...f, max_score: e.target.value }))} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Due Days</Label>
                <Input type="number" value={form.due_days} onChange={e => setForm(f => ({ ...f, due_days: e.target.value }))} className="h-9" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_published} onCheckedChange={v => setForm(f => ({ ...f, is_published: v }))} />
              <Label className="text-xs">Published</Label>
            </div>
            <Button onClick={handleSave} className="w-full bg-accent hover:bg-accent-hover text-accent-foreground" disabled={saveAssignment.isPending}>
              {saveAssignment.isPending ? 'Saving...' : 'Save Assignment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grade Dialog */}
      <Dialog open={gradeDialog.open} onOpenChange={o => setGradeDialog({ ...gradeDialog, open: o })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Grade Submission</DialogTitle>
            <DialogDescription>{gradeDialog.submission?.user_profiles?.full_name} — {gradeDialog.submission?.assignments?.title}</DialogDescription>
          </DialogHeader>
          {gradeDialog.submission?.submission_text && (
            <div className="bg-muted rounded-lg p-3 text-sm max-h-32 overflow-y-auto">{gradeDialog.submission.submission_text}</div>
          )}
          {gradeDialog.submission?.file_url && (
            <a href={gradeDialog.submission.file_url} target="_blank" rel="noopener" className="text-sm text-primary underline flex items-center gap-1.5">
              {gradeDialog.submission.file_url.includes('drive.google.com') || gradeDialog.submission.file_url.includes('docs.google.com') ? (
                <>
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.6 66.85L3.3 61.35 29.3 17.45H58.1L31.65 61.65Z" fill="#0066DA"/>
                    <path d="M27.5 78L0 39 13.7 17.45 41.2 56.55Z" fill="#00AC47"/>
                    <path d="M45.5 78H0L13.7 56.55H59.2Z" fill="#EA4335"/>
                    <path d="M73.6 78H45.5L59.2 56.55H86.8Z" fill="#00832D"/>
                    <path d="M86.8 56.55L73.6 78 45.5 34.1 58.1 17.45Z" fill="#2684FC"/>
                    <path d="M58.1 17.45L86.8 56.55 73.1 34.1Z" fill="#FFBA00"/>
                  </svg>
                  Open in Google Drive
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Drive</Badge>
                </>
              ) : (
                <><FileText className="h-3 w-3" /> View file</>
              )}
            </a>
          )}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Score (max {gradeDialog.submission?.assignments?.max_score || 100})</Label>
              <Input type="number" value={gradeForm.score} onChange={e => setGradeForm(f => ({ ...f, score: e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Feedback</Label>
              <Textarea value={gradeForm.feedback} onChange={e => setGradeForm(f => ({ ...f, feedback: e.target.value }))} rows={3} />
            </div>
            <Button onClick={() => gradeSubmission.mutate({ id: gradeDialog.submission.id, score: parseInt(gradeForm.score) || 0, feedback: gradeForm.feedback })} className="w-full bg-accent hover:bg-accent-hover text-accent-foreground" disabled={gradeSubmission.isPending}>
              {gradeSubmission.isPending ? 'Saving...' : 'Save Grade'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssignmentTab;
