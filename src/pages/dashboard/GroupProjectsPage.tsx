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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, FileUp, Upload, Clock } from 'lucide-react';
import { toast } from 'sonner';

const GroupProjectsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [submitForm, setSubmitForm] = useState({ title: '', description: '', file_url: '' });

  // Get groups the student belongs to
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

  // Get submissions for all groups
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

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('project_submissions').insert({
        group_id: selectedGroup.id,
        title: submitForm.title,
        description: submitForm.description || null,
        file_url: submitForm.file_url || null,
        submitted_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-submissions'] });
      setSubmitOpen(false);
      setSubmitForm({ title: '', description: '', file_url: '' });
      toast.success('Submission uploaded');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" /> Group Projects
        </h1>
        <p className="text-sm text-muted-foreground">Collaborate with your group on course projects</p>
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground animate-pulse">Loading...</p>
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

          return (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{group.courses?.title}</p>
                  </div>
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => { setSelectedGroup(group); setSubmitOpen(true); }}
                  >
                    <Upload className="h-3.5 w-3.5" /> Submit Work
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.description && (
                  <p className="text-sm text-muted-foreground">{group.description}</p>
                )}

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
                          <div>
                            <p className="font-medium text-sm">{s.title}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(s.created_at).toLocaleDateString()} by {s.user_profiles?.full_name}
                            </p>
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
            <div><Label>File URL</Label><Input value={submitForm.file_url} onChange={e => setSubmitForm(p => ({ ...p, file_url: e.target.value }))} placeholder="https://..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
            <Button onClick={() => submitMutation.mutate()} disabled={!submitForm.title || submitMutation.isPending}>
              {submitMutation.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupProjectsPage;
