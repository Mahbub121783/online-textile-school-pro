import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Briefcase, Star, Send, Users, ClipboardList, FileText, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const InstructorInternships = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [reviewForm, setReviewForm] = useState({ status: '', rating: '', interview_notes: '' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', due_date: '' });
  const [feedback, setFeedback] = useState('');

  // Internships supervised by this instructor
  const { data: internships = [] } = useQuery({
    queryKey: ['instructor-internships', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('internships')
        .select('*')
        .eq('supervisor_id', user!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const internshipIds = internships.map((i: any) => i.id);

  // Applications for those internships
  const { data: applications = [] } = useQuery({
    queryKey: ['instructor-intern-apps', internshipIds],
    queryFn: async () => {
      if (!internshipIds.length) return [];
      const { data } = await supabase
        .from('internship_applications')
        .select('*, internship:internships(title, company), applicant:user_profiles!internship_applications_user_id_fkey(full_name, avatar_url)')
        .in('internship_id', internshipIds)
        .order('applied_at', { ascending: false });
      return data ?? [];
    },
    enabled: internshipIds.length > 0,
  });

  // Logs from accepted interns
  const acceptedAppIds = applications.filter((a: any) => a.status === 'accepted').map((a: any) => a.id);
  const { data: logs = [] } = useQuery({
    queryKey: ['instructor-intern-logs', acceptedAppIds],
    queryFn: async () => {
      if (!acceptedAppIds.length) return [];
      const { data } = await supabase
        .from('internship_logs')
        .select('*, user:user_profiles!internship_logs_user_id_fkey(full_name)')
        .in('application_id', acceptedAppIds)
        .order('log_date', { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: acceptedAppIds.length > 0,
  });

  // Tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['instructor-intern-tasks', internshipIds],
    queryFn: async () => {
      if (!internshipIds.length) return [];
      const { data } = await supabase
        .from('internship_tasks')
        .select('*, application:internship_applications(user_id, internship:internships(title))')
        .in('internship_id', internshipIds)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: internshipIds.length > 0,
  });

  const updateAppMutation = useMutation({
    mutationFn: async () => {
      const updates: any = { status: reviewForm.status, reviewed_by: user!.id };
      if (reviewForm.rating) updates.rating = parseInt(reviewForm.rating);
      if (reviewForm.interview_notes) updates.interview_notes = reviewForm.interview_notes;
      const { error } = await supabase.from('internship_applications').update(updates).eq('id', selectedApp.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-intern-apps'] });
      setReviewOpen(false);
      toast.success('Application updated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('internship_tasks').insert({
        internship_id: selectedApp.internship_id,
        application_id: selectedApp.id,
        title: taskForm.title,
        description: taskForm.description || null,
        due_date: taskForm.due_date || null,
        assigned_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-intern-tasks'] });
      setTaskOpen(false);
      setTaskForm({ title: '', description: '', due_date: '' });
      toast.success('Task assigned');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('internship_logs')
        .update({ supervisor_feedback: feedback })
        .eq('id', selectedLog.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-intern-logs'] });
      setFeedbackOpen(false);
      setFeedback('');
      toast.success('Feedback added');
    },
  });

  const reviewTaskMutation = useMutation({
    mutationFn: async ({ taskId, fb, status }: { taskId: string; fb: string; status: string }) => {
      const { error } = await supabase.from('internship_tasks')
        .update({ feedback: fb, status })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-intern-tasks'] });
      toast.success('Task reviewed');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Internship Supervision</h1>
        <p className="text-muted-foreground text-sm">Manage your assigned internships, review applications, and track interns</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{internships.length}</p>
          <p className="text-xs text-muted-foreground">Internships</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{applications.length}</p>
          <p className="text-xs text-muted-foreground">Applications</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{acceptedAppIds.length}</p>
          <p className="text-xs text-muted-foreground">Active Interns</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{tasks.filter((t: any) => t.status === 'completed').length}/{tasks.length}</p>
          <p className="text-xs text-muted-foreground">Tasks Done</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="mt-4">
          {applications.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No applications to review.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Internship</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((app: any) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium text-sm">{(app as any).applicant?.full_name || 'Unknown'}</TableCell>
                        <TableCell className="text-sm">{(app as any).internship?.title}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize text-xs">{app.status}</Badge></TableCell>
                        <TableCell>{app.rating ? <span className="flex items-center gap-0.5 text-sm"><Star className="h-3 w-3 text-yellow-500" />{app.rating}/5</span> : '—'}</TableCell>
                        <TableCell className="text-xs">{new Date(app.applied_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => { setSelectedApp(app); setReviewForm({ status: app.status, rating: app.rating?.toString() || '', interview_notes: app.interview_notes || '' }); setReviewOpen(true); }}>
                              Review
                            </Button>
                            {app.status === 'accepted' && (
                              <Button size="sm" variant="outline" onClick={() => { setSelectedApp(app); setTaskOpen(true); }}>
                                <ClipboardList className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {tasks.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No tasks assigned yet.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Internship</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Submission</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium text-sm">{t.title}</TableCell>
                        <TableCell className="text-xs">{(t as any).application?.internship?.title}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize text-xs">{t.status}</Badge></TableCell>
                        <TableCell className="text-xs">{t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}</TableCell>
                        <TableCell>
                          {t.submission_url ? <a href={t.submission_url} target="_blank" className="text-xs text-primary underline">View</a> : '—'}
                        </TableCell>
                        <TableCell>
                          {t.status === 'completed' && !t.feedback && (
                            <Button size="sm" variant="outline" onClick={() => {
                              const fb = prompt('Enter feedback for this task:');
                              if (fb) reviewTaskMutation.mutate({ taskId: t.id, fb, status: 'reviewed' });
                            }}>
                              <MessageSquare className="h-3.5 w-3.5 mr-1" /> Feedback
                            </Button>
                          )}
                          {t.feedback && <span className="text-xs text-green-600">✓ Reviewed</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          {logs.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No activity logs yet.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {logs.map((log: any) => (
                <Card key={log.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-sm">{(log as any).user?.full_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{new Date(log.log_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{log.hours_worked}h</Badge>
                        {!log.supervisor_feedback && (
                          <Button size="sm" variant="outline" onClick={() => { setSelectedLog(log); setFeedback(''); setFeedbackOpen(true); }}>
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm">{log.activities}</p>
                    {log.learnings && <p className="text-xs text-muted-foreground mt-1">Learnings: {log.learnings}</p>}
                    {log.supervisor_feedback && (
                      <div className="mt-2 p-2 bg-primary/5 rounded text-xs">
                        <span className="font-medium">Your Feedback:</span> {log.supervisor_feedback}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Review Application</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select value={reviewForm.status} onValueChange={v => setReviewForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['applied', 'shortlisted', 'interviewed', 'offered', 'accepted', 'rejected'].map(s =>
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rating (1-5)</Label>
              <Select value={reviewForm.rating} onValueChange={v => setReviewForm(p => ({ ...p, rating: v }))}>
                <SelectTrigger><SelectValue placeholder="Rate" /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5].map(n => <SelectItem key={n} value={n.toString()}>{n} ★</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={reviewForm.interview_notes} onChange={e => setReviewForm(p => ({ ...p, interview_notes: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button onClick={() => updateAppMutation.mutate()} disabled={updateAppMutation.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Task Dialog */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign Task</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} rows={3} /></div>
            <div><Label>Due Date</Label><Input type="date" value={taskForm.due_date} onChange={e => setTaskForm(p => ({ ...p, due_date: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)}>Cancel</Button>
            <Button onClick={() => createTaskMutation.mutate()} disabled={createTaskMutation.isPending || !taskForm.title}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Feedback</DialogTitle></DialogHeader>
          <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={4} placeholder="Your feedback on this log entry..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackOpen(false)}>Cancel</Button>
            <Button onClick={() => feedbackMutation.mutate()} disabled={feedbackMutation.isPending || !feedback}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstructorInternships;
