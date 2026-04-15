import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, UserPlus, UserMinus, ShieldCheck, ShieldOff, Lock, Unlock, MoreHorizontal, Award } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const CourseSettingsTab = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; courseId: string }>({ open: false, courseId: '' });
  const [certDialog, setCertDialog] = useState<{ open: boolean; courseId: string }>({ open: false, courseId: '' });
  const [instructorSearch, setInstructorSearch] = useState('');
  const [certSearchTerm, setCertSearchTerm] = useState('');
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['course-settings-list', statusFilter, search],
    queryFn: async () => {
      let q = supabase.from('courses').select('*, user_profiles!courses_instructor_id_fkey(full_name, avatar_url)').order('created_at', { ascending: false });
      if (statusFilter === 'published') q = q.eq('is_published', true);
      if (statusFilter === 'unpublished') q = q.eq('is_published', false);
      if (statusFilter === 'blocked') q = q.eq('review_status', 'rejected');
      if (search) q = q.ilike('title', `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: instructors = [] } = useQuery({
    queryKey: ['settings-instructors', instructorSearch],
    enabled: assignDialog.open,
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').in('role', ['instructor', 'admin', 'super_admin']);
      const ids = roles?.map(r => r.user_id) ?? [];
      if (ids.length === 0) return [];
      let q = supabase.from('user_profiles').select('id, full_name, avatar_url').in('id', ids);
      if (instructorSearch) q = q.ilike('full_name', `%${instructorSearch}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: certTemplates = [] } = useQuery({
    queryKey: ['cert-templates-settings', certSearchTerm],
    enabled: certDialog.open,
    queryFn: async () => {
      let q = supabase.from('certificate_templates').select('id, name, background_url, download_rule, min_score_pct').order('name');
      if (certSearchTerm) q = q.ilike('name', `%${certSearchTerm}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const updateCourse = useMutation({
    mutationFn: async ({ courseId, updates }: { courseId: string; updates: any }) => {
      const { error } = await supabase.from('courses').update(updates).eq('id', courseId);
      if (error) throw error;
      await supabase.from('admin_activity_log').insert({ admin_id: user!.id, action: Object.keys(updates).join(', '), target_type: 'course', target_id: courseId });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['course-settings-list'] }); toast.success('Course updated'); },
    onError: (e: any) => toast.error(e.message),
  });

  const assignInstructor = useMutation({
    mutationFn: async ({ courseId, instructorId }: { courseId: string; instructorId: string }) => {
      const { error } = await supabase.from('courses').update({ instructor_id: instructorId }).eq('id', courseId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['course-settings-list'] }); setAssignDialog({ open: false, courseId: '' }); toast.success('Instructor assigned'); },
  });

  const deassignInstructor = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase.from('courses').update({ instructor_id: null }).eq('id', courseId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['course-settings-list'] }); toast.success('Instructor removed'); },
  });

  const assignCert = useMutation({
    mutationFn: async ({ courseId, templateId }: { courseId: string; templateId: string | null }) => {
      const { error } = await supabase.from('courses').update({ cert_template_id: templateId }).eq('id', courseId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['course-settings-list'] }); setCertDialog({ open: false, courseId: '' }); toast.success('Certificate template updated'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="unpublished">Unpublished</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : courses.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No courses.</TableCell></TableRow>
              ) : courses.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <p className="font-medium text-sm truncate max-w-[200px]">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.slug}</p>
                  </TableCell>
                  <TableCell>
                    {c.user_profiles?.full_name ? (
                      <span className="text-sm">{c.user_profiles.full_name}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.review_status === 'approved' ? 'default' : c.review_status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                      {c.review_status || 'draft'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.is_published ? (
                      <Badge variant="outline" className="text-xs gap-1 text-primary"><Unlock className="h-3 w-3" /> Live</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs gap-1 text-muted-foreground"><Lock className="h-3 w-3" /> Hidden</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setAssignDialog({ open: true, courseId: c.id })}>
                          <UserPlus className="h-4 w-4 mr-2" /> Assign Instructor
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setCertDialog({ open: true, courseId: c.id })}>
                          <Award className="h-4 w-4 mr-2" /> Assign Certificate
                        </DropdownMenuItem>
                        {c.instructor_id && (
                          <DropdownMenuItem onClick={() => deassignInstructor.mutate(c.id)}>
                            <UserMinus className="h-4 w-4 mr-2" /> Remove Instructor
                          </DropdownMenuItem>
                        )}
                        {c.is_published ? (
                          <DropdownMenuItem onClick={() => updateCourse.mutate({ courseId: c.id, updates: { is_published: false } })}>
                            <Lock className="h-4 w-4 mr-2" /> Unpublish
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => updateCourse.mutate({ courseId: c.id, updates: { is_published: true, review_status: 'approved' } })}>
                            <Unlock className="h-4 w-4 mr-2" /> Publish
                          </DropdownMenuItem>
                        )}
                        {c.review_status !== 'rejected' ? (
                          <DropdownMenuItem className="text-destructive" onClick={() => updateCourse.mutate({ courseId: c.id, updates: { review_status: 'rejected', is_published: false } })}>
                            <ShieldOff className="h-4 w-4 mr-2" /> Block Course
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => updateCourse.mutate({ courseId: c.id, updates: { review_status: 'approved' } })}>
                            <ShieldCheck className="h-4 w-4 mr-2" /> Unblock Course
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assign Instructor Dialog */}
      <Dialog open={assignDialog.open} onOpenChange={o => setAssignDialog({ ...assignDialog, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Instructor</DialogTitle>
            <DialogDescription>Select an instructor for this course.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={instructorSearch} onChange={e => setInstructorSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {instructors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No instructors found.</p>
            ) : instructors.map((inst: any) => (
              <button key={inst.id} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left" onClick={() => assignInstructor.mutate({ courseId: assignDialog.courseId, instructorId: inst.id })}>
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                  {inst.avatar_url ? <img src={inst.avatar_url} alt="" className="w-full h-full object-cover" /> : inst.full_name?.[0]?.toUpperCase() || '?'}
                </div>
                <span className="text-sm font-medium">{inst.full_name || 'Unknown'}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Certificate Dialog */}
      <Dialog open={certDialog.open} onOpenChange={o => setCertDialog({ ...certDialog, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Certificate Template</DialogTitle>
            <DialogDescription>Select a certificate template for this course.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search templates..." value={certSearchTerm} onChange={e => setCertSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left" onClick={() => assignCert.mutate({ courseId: certDialog.courseId, templateId: null })}>
              <span className="text-sm text-muted-foreground">No certificate</span>
            </button>
            {certTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No templates found.</p>
            ) : certTemplates.map((t: any) => (
              <button key={t.id} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left" onClick={() => assignCert.mutate({ courseId: certDialog.courseId, templateId: t.id })}>
                <div className="w-12 h-8 rounded bg-muted overflow-hidden shrink-0 border">
                  {t.background_url ? <img src={t.background_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Award className="h-4 w-4 text-muted-foreground" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block truncate">{t.name}</span>
                  <span className="text-[10px] text-muted-foreground">{t.download_rule === 'gradebook_pass' ? `Score ≥ ${t.min_score_pct}%` : t.download_rule === 'course_complete' ? 'Course Complete' : 'Anytime'}</span>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CourseSettingsTab;
