import { CardGridSkeleton } from '@/components/ui/loading-skeletons';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, FileUp, Upload, Clock, CalendarClock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFileUpload } from '@/hooks/useFileUpload';

const GroupProjectsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [submitForm, setSubmitForm] = useState({ title: '', description: '' });
  const [uploadedUrl, setUploadedUrl] = useState('');

  const { upload, uploading: isUploading } = useFileUpload();

  const { data: myGroups = [], isLoading } = useQuery({
    queryKey: ['my-project-groups', user?.id],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from('project_group_members')
        .select('group_id, role')
        .eq('user_id', user!.id);

      if (!memberships?.length) return [];

      const groupIds = memberships.map(m => m.group_id);
      const { data: groups } = await supabase
        .from('project_groups')
        .select('*, courses(title), project_group_members(user_id, role, user_profiles:user_id(full_name))')
        .in('id', groupIds);

      return groups ?? [];
    },
    enabled: !!user?.id,
  });

  const groupIds = myGroups.map((g: any) => g.id);
  const { data: submissions = [] } = useQuery({
    queryKey: ['group-submissions', groupIds],
    queryFn: async () => {
      if (!groupIds.length) return [];
      const { data } = await supabase
        .from('project_submissions')
        .select('*, user_profiles:submitted_by(full_name)')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: groupIds.length > 0,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await upload(file, { forceR2: true });
      setUploadedUrl(result.url);
      toast.success('File uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('project_submissions').insert({
        group_id: selectedGroup.id,
        title: submitForm.title,
        description: submitForm.description || null,
        file_url: uploadedUrl || null,
        submitted_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-submissions'] });
      setSubmitOpen(false);
      setSubmitForm({ title: '', description: '' });
      setUploadedUrl('');
      toast.success('Submission uploaded');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getDeadlineInfo = (deadline: string | null) => {
    if (!deadline) return null;
    const d = new Date(deadline);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: 'Overdue', variant: 'destructive' as const };
    if (days <= 3) return { text: `${days}d left`, variant: 'destructive' as const };
    if (days <= 7) return { text: `${days}d left`, variant: 'default' as const };
    return { text: `${days}d left`, variant: 'secondary' as const };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" /> Group Projects
        </h1>
        <p className="text-sm text-muted-foreground">Collaborate with your group on course projects</p>
      </div>

      {isLoading ? (
        <CardGridSkeleton count={3} columns={3} />
      ) : myGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted" />
            <p className="text-muted-foreground">You are not assigned to any project groups yet.</p>
          </CardContent>
        </Card>
      ) : (
        myGroups.map((group: any) => {
          const groupSubmissions = submissions.filter((s: any) => s.group_id === group.id);
          const deadlineInfo = getDeadlineInfo(group.deadline);
          const maxExpected = group.max_submissions || 5;
          const progressPct = Math.min(100, Math.round((groupSubmissions.length / maxExpected) * 100));

          return (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{group.courses?.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {deadlineInfo && (
                      <Badge variant={deadlineInfo.variant} className="gap-1">
                        <CalendarClock className="h-3 w-3" /> {deadlineInfo.text}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => { setSelectedGroup(group); setSubmitOpen(true); }}
                    >
                      <Upload className="h-3.5 w-3.5" /> Submit Work
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.description && (
                  <p className="text-sm text-muted-foreground">{group.description}</p>
                )}

                {/* Progress */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Progress</span>
                  <Progress value={progressPct} className="flex-1 h-2" />
                  <span className="text-xs font-medium">{groupSubmissions.length}/{maxExpected}</span>
                </div>

                {/* Members */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Members</h4>
                  <div className="flex flex-wrap gap-2">
                    {group.project_group_members?.map((m: any) => (
                      <Badge key={m.user_id} variant="outline" className="text-xs">
                        {m.user_profiles?.full_name || 'Unknown'}
                        {m.role === 'leader' && ' ⭐'}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Submissions */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Submissions</h4>
                  {groupSubmissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No submissions yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {groupSubmissions.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-sm">{s.title}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(s.created_at).toLocaleDateString()} by {s.user_profiles?.full_name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {s.score != null && <Badge className="text-xs">{s.score} pts</Badge>}
                            {s.file_url && (
                              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                                <a href={s.file_url} target="_blank" rel="noopener noreferrer">
                                  <FileUp className="h-3 w-3 mr-1" /> View
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Submit Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Submit to {selectedGroup?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={submitForm.title} onChange={e => setSubmitForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={submitForm.description} onChange={e => setSubmitForm(p => ({ ...p, description: e.target.value }))} rows={3} /></div>
            <div>
              <Label>Upload File</Label>
              <Input type="file" onChange={handleFileUpload} disabled={isUploading} />
              {isUploading && <p className="text-xs text-muted-foreground mt-1 animate-pulse">Uploading...</p>}
              {uploadedUrl && <p className="text-xs text-green-600 mt-1">✓ File uploaded</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSubmitOpen(false); setUploadedUrl(''); }}>Cancel</Button>
            <Button onClick={() => submitMutation.mutate()} disabled={!submitForm.title || submitMutation.isPending || isUploading}>
              {submitMutation.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupProjectsPage;
