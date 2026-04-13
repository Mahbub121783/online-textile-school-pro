import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2, Users, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const emptyForm = { name: '', description: '', max_members: 4, course_id: '' };

const AdminProjectGroups = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [courseFilter, setCourseFilter] = useState<string>('all');

  const { data: courses = [] } = useQuery({
    queryKey: ['courses-for-groups'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').eq('is_published', true).order('title');
      return data ?? [];
    },
  });

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['admin-project-groups', courseFilter],
    queryFn: async () => {
      let q = supabase
        .from('project_groups')
        .select('*, courses(title), project_group_members(id, user_id, role, user_profiles:user_id(full_name))')
        .order('created_at', { ascending: false });
      if (courseFilter !== 'all') q = q.eq('course_id', courseFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        max_members: form.max_members,
        course_id: form.course_id,
        created_by: user?.id,
      };
      if (editing) {
        const { error } = await supabase.from('project_groups').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('project_groups').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-project-groups'] });
      setOpen(false); setEditing(null); setForm(emptyForm);
      toast.success(editing ? 'Group updated' : 'Group created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-project-groups'] });
      toast.success('Group deleted');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('project_group_members').delete().eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-project-groups'] });
      toast.success('Member removed');
    },
  });

  // Enrolled students for adding members
  const { data: enrolledStudents = [] } = useQuery({
    queryKey: ['enrolled-students', selectedGroup?.course_id],
    queryFn: async () => {
      if (!selectedGroup?.course_id) return [];
      const { data } = await supabase
        .from('enrollments')
        .select('user_id, user_profiles:user_id(id, full_name)')
        .eq('course_id', selectedGroup.course_id);
      return data ?? [];
    },
    enabled: !!selectedGroup?.course_id,
  });

  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('project_group_members').insert({
        group_id: selectedGroup.id,
        user_id: userId,
        role: 'member',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-project-groups'] });
      toast.success('Member added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (g: any) => {
    setEditing(g);
    setForm({ name: g.name, description: g.description || '', max_members: g.max_members, course_id: g.course_id });
    setOpen(true);
  };

  const currentMemberIds = selectedGroup?.project_group_members?.map((m: any) => m.user_id) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Project Groups</h1>
          <p className="text-sm text-muted-foreground">Manage group projects for courses</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }} className="gap-1">
          <Plus className="h-4 w-4" /> Create Group
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-sm">Course:</Label>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group Name</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Max</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 animate-pulse text-muted-foreground">Loading...</TableCell></TableRow>
              ) : groups.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 text-muted" />No project groups yet.
                </TableCell></TableRow>
              ) : (
                groups.map((g: any) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{g.courses?.title || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {g.project_group_members?.length || 0} members
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{g.max_members}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedGroup(g); setMembersOpen(true); }}>
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(g)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(g.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Group Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Group' : 'Create Group'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Course *</Label>
              <Select value={form.course_id} onValueChange={v => setForm(p => ({ ...p, course_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Group Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div><Label>Max Members</Label><Input type="number" value={form.max_members} onChange={e => setForm(p => ({ ...p, max_members: parseInt(e.target.value) || 4 }))} min={2} max={20} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || !form.course_id || saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Members — {selectedGroup?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Current Members</h4>
            {selectedGroup?.project_group_members?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              selectedGroup?.project_group_members?.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between py-1">
                  <span className="text-sm">{m.user_profiles?.full_name || 'Unknown'}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeMemberMutation.mutate(m.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            <hr />
            <h4 className="text-sm font-medium">Add from Enrolled Students</h4>
            {enrolledStudents
              .filter((e: any) => !currentMemberIds.includes(e.user_id))
              .map((e: any) => (
                <div key={e.user_id} className="flex items-center justify-between py-1">
                  <span className="text-sm">{e.user_profiles?.full_name || 'Unknown'}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => addMemberMutation.mutate(e.user_id)}
                    disabled={addMemberMutation.isPending}
                  >
                    Add
                  </Button>
                </div>
              ))}
            {enrolledStudents.filter((e: any) => !currentMemberIds.includes(e.user_id)).length === 0 && (
              <p className="text-sm text-muted-foreground">No more enrolled students to add.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProjectGroups;
