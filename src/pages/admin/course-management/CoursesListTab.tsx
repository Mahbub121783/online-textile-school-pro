import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Check, X, Eye, Pencil, PlusCircle, MoreHorizontal, Trash2, Search } from 'lucide-react';

const CoursesListTab = () => {
  const [tab, setTab] = useState('all');
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; courseId: string }>({ open: false, courseId: '' });
  const [rejectionReason, setRejectionReason] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: courses, isLoading } = useQuery({
    queryKey: ['admin-courses-list', tab, search],
    queryFn: async () => {
      let q = supabase.from('courses').select('*, user_profiles!courses_instructor_id_fkey(full_name, avatar_url)').order('created_at', { ascending: false });
      if (tab !== 'all') q = q.eq('review_status', tab);
      if (search) q = q.ilike('title', `%${search}%`);
      const { data } = await q.limit(5000);
      return data ?? [];
    },
  });

  const approveCourse = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase.from('courses').update({ review_status: 'approved', is_published: true }).eq('id', courseId);
      if (error) throw error;
      await supabase.from('admin_activity_log').insert({ admin_id: user!.id, action: 'Approved course', target_type: 'course', target_id: courseId });
      // Notify instructor
      const { createNotificationWithEmail, notifyAllStudentsWithEmail, NOTIFICATION_TYPES } = await import('@/lib/notifications');
      const course = courses?.find((c: any) => c.id === courseId);
      if (course?.instructor_id) {
        await createNotificationWithEmail({
          userId: course.instructor_id,
          type: NOTIFICATION_TYPES.COURSE_APPROVED,
          title: 'Course Approved ✅',
          message: `Your course "${course.title}" has been approved and is now published!`,
          link: `/courses/${course.slug}`,
        });
      }
      // Notify all students about new course
      await notifyAllStudentsWithEmail({
        type: NOTIFICATION_TYPES.COURSE_PUBLISHED,
        title: 'New Course Available 📚',
        message: `A new course "${course?.title}" is now available. Check it out!`,
        link: `/courses/${course?.slug}`,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-courses-list'] }); toast.success('Course approved'); },
  });

  const rejectCourse = useMutation({
    mutationFn: async ({ courseId, reason }: { courseId: string; reason: string }) => {
      const { error } = await supabase.from('courses').update({ review_status: 'rejected', rejection_reason: reason, is_published: false }).eq('id', courseId);
      if (error) throw error;
      await supabase.from('admin_activity_log').insert({ admin_id: user!.id, action: 'Rejected course', target_type: 'course', target_id: courseId, details: { reason } as any });
      // Notify instructor
      const { createNotificationWithEmail, NOTIFICATION_TYPES } = await import('@/lib/notifications');
      const course = courses?.find((c: any) => c.id === courseId);
      if (course?.instructor_id) {
        await createNotificationWithEmail({
          userId: course.instructor_id,
          type: NOTIFICATION_TYPES.COURSE_REJECTED,
          title: 'Course Rejected ❌',
          message: `Your course "${course?.title}" was rejected. Reason: ${reason}`,
          link: '/instructor/courses',
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-courses-list'] }); setRejectDialog({ open: false, courseId: '' }); setRejectionReason(''); toast.success('Course rejected'); },
  });

  const deleteCourse = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase.from('courses').update({ is_published: false, review_status: 'draft' }).eq('id', courseId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-courses-list'] }); toast.success('Course archived'); },
  });

  const toggleSelect = (id: string) => setSelected(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  const toggleAll = () => { if (!courses) return; setSelected(selected.length === courses.length ? [] : courses.map((c: any) => c.id)); };

  const bulkApprove = async () => { for (const id of selected) await approveCourse.mutateAsync(id); setSelected([]); };
  const bulkReject = async () => { for (const id of selected) await rejectCourse.mutateAsync({ courseId: id, reason: 'Bulk rejected' }); setSelected([]); };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      approved: { variant: 'default', label: 'Approved' }, pending: { variant: 'secondary', label: 'Pending' },
      rejected: { variant: 'destructive', label: 'Rejected' }, draft: { variant: 'outline', label: 'Draft' },
    };
    const m = map[status] ?? { variant: 'outline' as const, label: status };
    return <Badge variant={m.variant}>{m.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">{selected.length} selected</span>
              <Button size="sm" variant="outline" className="text-primary gap-1" onClick={bulkApprove}><Check className="h-3.5 w-3.5" /> Approve</Button>
              <Button size="sm" variant="outline" className="text-destructive gap-1" onClick={bulkReject}><X className="h-3.5 w-3.5" /> Reject</Button>
            </>
          )}
          <Button size="sm" className="bg-accent hover:bg-accent-hover text-accent-foreground gap-1.5" onClick={() => navigate('/admin/cms/courses/new')}>
            <PlusCircle className="h-4 w-4" /> Create Course
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => { setTab(v); setSelected([]); }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={courses?.length ? selected.length === courses.length : false} onCheckedChange={toggleAll} /></TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : courses?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No courses found.</TableCell></TableRow>
              ) : courses?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell><Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggleSelect(c.id)} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {c.thumbnail_url ? <img src={c.thumbnail_url} alt="" className="w-14 h-10 rounded object-cover shrink-0" /> : <div className="w-14 h-10 rounded bg-muted shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{c.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{c.user_profiles?.full_name || <span className="text-muted-foreground italic">None</span>}</TableCell>
                  <TableCell className="text-sm">৳{c.price ?? 0}</TableCell>
                  <TableCell>{statusBadge(c.review_status ?? 'draft')}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => window.open(`/courses/${c.slug}`, '_blank')}><Eye className="h-4 w-4 mr-2" /> View</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/admin/cms/courses/${c.id}`)}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                        {c.review_status !== 'approved' && <DropdownMenuItem onClick={() => approveCourse.mutate(c.id)}><Check className="h-4 w-4 mr-2 text-primary" /> Approve</DropdownMenuItem>}
                        {c.review_status !== 'rejected' && <DropdownMenuItem onClick={() => setRejectDialog({ open: true, courseId: c.id })}><X className="h-4 w-4 mr-2 text-destructive" /> Reject</DropdownMenuItem>}
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteCourse.mutate(c.id)}><Trash2 className="h-4 w-4 mr-2" /> Archive</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={rejectDialog.open} onOpenChange={o => setRejectDialog({ ...rejectDialog, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Course</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this course.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Rejection reason..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={4} />
          <Button variant="destructive" onClick={() => rejectCourse.mutate({ courseId: rejectDialog.courseId, reason: rejectionReason })} disabled={!rejectionReason.trim()}>Confirm Rejection</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoursesListTab;
