import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, ClipboardList, MessageSquare } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const InstructorAssignments = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showGradeDialog, setShowGradeDialog] = useState(false);
  const [gradingSub, setGradingSub] = useState<any>(null);
  const [gradeForm, setGradeForm] = useState({ score: '', feedback: '', status: 'graded' });
  const [form, setForm] = useState({ title: '', description: '', instructions: '', course_id: '', max_score: '100', due_days: '7' });
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  const { data: courses = [] } = useQuery({
    queryKey: ['instructor-courses-list', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').eq('instructor_id', user!.id);
      return data ?? [];
    },
  });

  const courseIds = courses.map((c: any) => c.id);

  const { data: assignments = [] } = useQuery({
    queryKey: ['instructor-assignments', courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('assignments').select('*, courses(title)').in('course_id', courseIds).order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['assignment-submissions', selectedAssignmentId],
    enabled: !!selectedAssignmentId,
    queryFn: async () => {
      const { data } = await supabase
        .from('assignment_submissions')
        .select('*, user_profiles(full_name, roll_id)')
        .eq('assignment_id', selectedAssignmentId!)
        .order('submitted_at', { ascending: false });
      return data ?? [];
    },
  });

  const saveAssignment = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title, description: form.description || null, instructions: form.instructions || null,
        course_id: form.course_id, max_score: Number(form.max_score) || 100,
        due_days: Number(form.due_days) || 7, is_published: true,
      };
      if (editing) {
        const { error } = await supabase.from('assignments').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('assignments').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? 'Assignment updated!' : 'Assignment created!' });
      setShowDialog(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['instructor-assignments'] });
    },
  });

  const gradeSubmission = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('assignment_submissions')
        .update({ score: Number(gradeForm.score), feedback: gradeForm.feedback || null, status: gradeForm.status, graded_at: new Date().toISOString() })
        .eq('id', gradingSub.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Submission graded!' });
      setShowGradeDialog(false);
      qc.invalidateQueries({ queryKey: ['assignment-submissions', selectedAssignmentId] });
    },
  });

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({ title: a.title, description: a.description || '', instructions: a.instructions || '', course_id: a.course_id, max_score: String(a.max_score), due_days: String(a.due_days) });
    setShowDialog(true);
  };

  const openGrade = (sub: any) => {
    setGradingSub(sub);
    setGradeForm({ score: sub.score ? String(sub.score) : '', feedback: sub.feedback || '', status: 'graded' });
    setShowGradeDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">Assignments</h2>
        <Button className="bg-accent hover:bg-accent-hover text-accent-foreground gap-2" onClick={() => { setEditing(null); setForm({ title: '', description: '', instructions: '', course_id: '', max_score: '100', due_days: '7' }); setShowDialog(true); }}>
          <Plus className="h-4 w-4" /> Create Assignment
        </Button>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="h-16 w-16 mx-auto mb-4 text-muted" />
          <p>No assignments yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {assignments.map((a: any) => (
            <div key={a.id} className={`bg-card border rounded-xl p-4 cursor-pointer transition-all ${selectedAssignmentId === a.id ? 'ring-2 ring-primary' : 'hover:shadow-md'}`} onClick={() => setSelectedAssignmentId(a.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-bold text-sm">{a.title}</h3>
                  <p className="text-xs text-muted-foreground">{a.courses?.title} · Max: {a.max_score} pts · Due: {a.due_days} days</p>
                </div>
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(a); }}><Edit className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submissions */}
      {selectedAssignmentId && (
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-heading font-bold text-lg mb-4">Submissions</h3>
          {submissions.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">No submissions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub: any) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{sub.user_profiles?.full_name || 'Student'}</p>
                      <p className="text-xs text-muted-foreground">{sub.user_profiles?.roll_id}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(sub.submitted_at), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={sub.status === 'graded' ? 'default' : sub.status === 'returned' ? 'destructive' : 'secondary'}>
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{sub.score ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => openGrade(sub)}>
                        <MessageSquare className="h-3.5 w-3.5" /> Grade
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Assignment dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Assignment' : 'Create Assignment'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div className="space-y-2">
              <Label>Course *</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm(p => ({ ...p, course_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>{courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="space-y-2"><Label>Instructions</Label><Textarea value={form.instructions} onChange={(e) => setForm(p => ({ ...p, instructions: e.target.value }))} rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Max Score</Label><Input type="number" value={form.max_score} onChange={(e) => setForm(p => ({ ...p, max_score: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Due Days</Label><Input type="number" value={form.due_days} onChange={(e) => setForm(p => ({ ...p, due_days: e.target.value }))} /></div>
            </div>
            <Button className="w-full bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => saveAssignment.mutate()} disabled={saveAssignment.isPending || !form.title || !form.course_id}>
              {saveAssignment.isPending ? 'Saving...' : 'Save Assignment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grade dialog */}
      <Dialog open={showGradeDialog} onOpenChange={setShowGradeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Grade Submission</DialogTitle></DialogHeader>
          {gradingSub && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium mb-1">{gradingSub.user_profiles?.full_name}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{gradingSub.submission_text}</p>
                {gradingSub.file_url && (
                  <a href={gradingSub.file_url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline mt-2 inline-flex items-center gap-1.5">
                    {gradingSub.file_url.includes('drive.google.com') || gradingSub.file_url.includes('docs.google.com') ? (
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
                      </>
                    ) : (
                      <>View file</>
                    )}
                  </a>
                )}
              </div>
              <div className="space-y-2"><Label>Score</Label><Input type="number" value={gradeForm.score} onChange={(e) => setGradeForm(p => ({ ...p, score: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Feedback</Label><Textarea value={gradeForm.feedback} onChange={(e) => setGradeForm(p => ({ ...p, feedback: e.target.value }))} rows={3} /></div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={gradeForm.status} onValueChange={(v) => setGradeForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="graded">Grade & Accept</SelectItem>
                    <SelectItem value="returned">Return for Revision</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => gradeSubmission.mutate()} disabled={gradeSubmission.isPending}>
                {gradeSubmission.isPending ? 'Saving...' : 'Submit Grade'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstructorAssignments;
