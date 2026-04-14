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
import { Briefcase, Calendar, Clock, CheckCircle2, FileText, Send, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { useFileUpload } from '@/hooks/useFileUpload';

const statusSteps = ['applied', 'shortlisted', 'interviewed', 'offered', 'accepted'];
const statusColors: Record<string, string> = {
  applied: 'outline', shortlisted: 'secondary', interviewed: 'secondary',
  offered: 'default', accepted: 'default', rejected: 'destructive', withdrawn: 'destructive',
};

const MyInternshipsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [logForm, setLogForm] = useState({ log_date: new Date().toISOString().split('T')[0], hours_worked: '', activities: '', learnings: '' });
  const { uploadFile, uploading } = useFileUpload();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['my-internship-apps-full', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('internship_applications')
        .select('*, internship:internships(*)')
        .eq('user_id', user!.id)
        .order('applied_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const acceptedApps = applications.filter((a: any) => a.status === 'accepted');
  const activeApps = applications.filter((a: any) => !['accepted', 'rejected', 'withdrawn'].includes(a.status));

  const { data: tasks = [] } = useQuery({
    queryKey: ['my-intern-tasks', user?.id],
    queryFn: async () => {
      const appIds = acceptedApps.map((a: any) => a.id);
      if (!appIds.length) return [];
      const { data } = await supabase
        .from('internship_tasks')
        .select('*')
        .in('application_id', appIds)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: acceptedApps.length > 0,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['my-intern-logs', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('internship_logs')
        .select('*')
        .eq('user_id', user!.id)
        .order('log_date', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const submitLogMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('internship_logs').insert({
        application_id: selectedApp.id,
        user_id: user!.id,
        log_date: logForm.log_date,
        hours_worked: parseFloat(logForm.hours_worked) || 0,
        activities: logForm.activities,
        learnings: logForm.learnings || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-intern-logs'] });
      setLogOpen(false);
      setLogForm({ log_date: new Date().toISOString().split('T')[0], hours_worked: '', activities: '', learnings: '' });
      toast.success('Log entry submitted!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitTaskMutation = useMutation({
    mutationFn: async ({ taskId, url }: { taskId: string; url: string }) => {
      const { error } = await supabase.from('internship_tasks')
        .update({ submission_url: url, submitted_at: new Date().toISOString(), status: 'completed' })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-intern-tasks'] });
      toast.success('Task submitted!');
    },
  });

  const handleTaskFileUpload = async (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, { forceR2: true });
    if (url) submitTaskMutation.mutate({ taskId, url });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">My Internships</h1>
        <p className="text-muted-foreground text-sm">Track your applications, tasks, and activity logs</p>
      </div>

      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
          <TabsTrigger value="workspace">Workspace ({acceptedApps.length})</TabsTrigger>
          <TabsTrigger value="logs">Activity Logs ({logs.length})</TabsTrigger>
        </TabsList>

        {/* Applications Tab */}
        <TabsContent value="applications" className="space-y-4 mt-4">
          {isLoading ? (
            <p className="text-muted-foreground animate-pulse text-center py-8">Loading...</p>
          ) : applications.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Briefcase className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">No applications yet. Browse <a href="/internships" className="text-primary underline">internships</a>.</p>
            </CardContent></Card>
          ) : (
            applications.map((app: any) => (
              <Card key={app.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-heading font-bold">{app.internship?.title}</h3>
                      <p className="text-sm text-muted-foreground">{app.internship?.company}</p>
                      <p className="text-xs text-muted-foreground mt-1">Applied: {new Date(app.applied_at).toLocaleDateString()}</p>
                      {app.interview_date && (
                        <p className="text-xs text-primary mt-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Interview: {new Date(app.interview_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Badge variant={statusColors[app.status] as any || 'outline'} className="capitalize">{app.status}</Badge>
                  </div>
                  {/* Status Timeline */}
                  <div className="flex items-center gap-1 mt-4 overflow-x-auto">
                    {statusSteps.map((step, idx) => {
                      const stepIdx = statusSteps.indexOf(app.status);
                      const isActive = idx <= stepIdx;
                      const isCurrent = step === app.status;
                      return (
                        <div key={step} className="flex items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                            {isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                          </div>
                          {idx < statusSteps.length - 1 && <div className={`w-8 h-0.5 ${isActive ? 'bg-primary' : 'bg-muted'}`} />}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {statusSteps.map(s => <span key={s} className="text-[9px] text-muted-foreground capitalize flex-1 text-center">{s}</span>)}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Workspace Tab */}
        <TabsContent value="workspace" className="space-y-4 mt-4">
          {acceptedApps.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No accepted internships yet.</CardContent></Card>
          ) : (
            <>
              {acceptedApps.map((app: any) => (
                <Card key={app.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">{app.internship?.title} — {app.internship?.company}</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedApp(app); setLogOpen(true); }}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> Add Log
                    </Button>
                  </CardHeader>
                </Card>
              ))}

              {/* Tasks */}
              {tasks.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Assigned Tasks</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.map((t: any) => (
                          <TableRow key={t.id}>
                            <TableCell>
                              <p className="font-medium text-sm">{t.title}</p>
                              {t.description && <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>}
                              {t.feedback && <p className="text-xs text-green-600 mt-1">Feedback: {t.feedback}</p>}
                            </TableCell>
                            <TableCell><Badge variant="outline" className="capitalize text-xs">{t.status}</Badge></TableCell>
                            <TableCell className="text-xs">{t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}</TableCell>
                            <TableCell>
                              {t.status === 'pending' || t.status === 'in_progress' ? (
                                <div>
                                  <Input type="file" className="text-xs h-8" onChange={e => handleTaskFileUpload(t.id, e)} disabled={uploading} />
                                </div>
                              ) : t.submission_url ? (
                                <a href={t.submission_url} target="_blank" className="text-xs text-primary underline">View Submission</a>
                              ) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="mt-4">
          {logs.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No activity logs yet.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {logs.map((log: any) => (
                <Card key={log.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{new Date(log.log_date).toLocaleDateString()}</span>
                      <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />{log.hours_worked}h</Badge>
                    </div>
                    <p className="text-sm">{log.activities}</p>
                    {log.learnings && <p className="text-xs text-muted-foreground mt-1">Learnings: {log.learnings}</p>}
                    {log.supervisor_feedback && (
                      <div className="mt-2 p-2 bg-primary/5 rounded text-xs">
                        <span className="font-medium">Supervisor Feedback:</span> {log.supervisor_feedback}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Log Dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Activity Log</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={logForm.log_date} onChange={e => setLogForm(p => ({ ...p, log_date: e.target.value }))} /></div>
              <div><Label>Hours Worked</Label><Input type="number" step="0.5" value={logForm.hours_worked} onChange={e => setLogForm(p => ({ ...p, hours_worked: e.target.value }))} /></div>
            </div>
            <div><Label>Activities</Label><Textarea value={logForm.activities} onChange={e => setLogForm(p => ({ ...p, activities: e.target.value }))} rows={3} placeholder="What did you work on today?" /></div>
            <div><Label>Key Learnings</Label><Textarea value={logForm.learnings} onChange={e => setLogForm(p => ({ ...p, learnings: e.target.value }))} rows={2} placeholder="What did you learn?" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button onClick={() => submitLogMutation.mutate()} disabled={submitLogMutation.isPending || !logForm.activities}>
              {submitLogMutation.isPending ? 'Saving...' : 'Submit Log'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyInternshipsPage;
