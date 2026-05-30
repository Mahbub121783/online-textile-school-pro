import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, BookOpen, Book, DollarSign, Users, UserCheck, FileQuestion, Award, ArrowUpDown, MoreHorizontal, Ban, CheckCircle, Download, Eye, UserX, ChevronLeft, ChevronRight, ShieldAlert, CalendarPlus, Gift, AtSign } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';

type SortKey = 'name' | 'joined' | 'spend';
const PER_PAGE = 25;

export default function AdminStudents() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('joined');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<{ type: 'block' | 'activate' | 'block-bulk' | 'activate-bulk'; ids: string[] } | null>(null);
  const [bulkAssignCourseOpen, setBulkAssignCourseOpen] = useState(false);
  const [bulkAssignEbookOpen, setBulkAssignEbookOpen] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [ebookSearch, setEbookSearch] = useState('');
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['admin-students'],
    queryFn: async () => {
      // 1) Get student user-ids (tiny payload, short URL)
      const { data: roles, error: rolesErr } = await supabase
        .from('user_roles').select('user_id').eq('role', 'student').limit(10000);
      if (rolesErr) throw rolesErr;
      if (!roles?.length) return [];
      const studentIdSet = new Set(roles.map(r => r.user_id));

      // 2) Fetch full tables (each is small) and filter client-side to AVOID
      //    sending 273-UUID `.in()` filters which blow past the URL length limit
      //    and caused the page to hang in loading state.
      const [
        { data: profiles },
        { data: enrollments },
        { data: orders },
        { data: orderItems },
        { data: certs },
        { data: quizAttempts },
        { data: emailReqs },
      ] = await Promise.all([
        supabase.from('user_profiles').select('*').limit(10000),
        supabase.from('enrollments').select('user_id').limit(10000),
        supabase.from('orders').select('id, user_id, total, status').eq('status', 'completed').limit(10000),
        supabase.from('order_items').select('order_id, item_type').eq('item_type', 'ebook').limit(10000),
        supabase.from('certificates').select('user_id').limit(10000),
        supabase.from('quiz_attempts').select('user_id').limit(10000),
        supabase.from('institutional_email_requests').select('user_id, requested_email, status, is_blocked').limit(10000),
      ]);

      const studentProfiles = (profiles ?? []).filter(p => studentIdSet.has(p.id));

      const orderById = new Map((orders ?? []).map(o => [o.id, o]));
      const ebookCountMap: Record<string, number> = {};
      (orderItems ?? []).forEach(oi => {
        const order = orderById.get(oi.order_id);
        if (order && studentIdSet.has(order.user_id)) {
          ebookCountMap[order.user_id] = (ebookCountMap[order.user_id] || 0) + 1;
        }
      });

      const enrollCountMap: Record<string, number> = {};
      (enrollments ?? []).forEach(e => {
        if (studentIdSet.has(e.user_id)) enrollCountMap[e.user_id] = (enrollCountMap[e.user_id] || 0) + 1;
      });

      const spendMap: Record<string, number> = {};
      (orders ?? []).forEach(o => {
        if (studentIdSet.has(o.user_id)) spendMap[o.user_id] = (spendMap[o.user_id] || 0) + (o.total || 0);
      });

      const certCountMap: Record<string, number> = {};
      (certs ?? []).forEach(c => {
        if (studentIdSet.has(c.user_id)) certCountMap[c.user_id] = (certCountMap[c.user_id] || 0) + 1;
      });

      const quizCountMap: Record<string, number> = {};
      (quizAttempts ?? []).forEach(q => {
        if (studentIdSet.has(q.user_id)) quizCountMap[q.user_id] = (quizCountMap[q.user_id] || 0) + 1;
      });

      const emailMap: Record<string, { email: string; status: string; is_blocked: boolean }> = {};
      (emailReqs ?? []).forEach((e: any) => {
        if (studentIdSet.has(e.user_id)) emailMap[e.user_id] = { email: e.requested_email, status: e.status, is_blocked: e.is_blocked };
      });

      return studentProfiles.map(p => ({
        ...p,
        coursesCount: enrollCountMap[p.id] || 0,
        ebooksCount: ebookCountMap[p.id] || 0,
        totalSpend: spendMap[p.id] || 0,
        certsCount: certCountMap[p.id] || 0,
        quizCount: quizCountMap[p.id] || 0,
        institutionalEmail: emailMap[p.id] || null,
      }));
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ ids, active }: { ids: string[]; active: boolean }) => {
      for (const uid of ids) {
        const { error } = await supabase.from('user_profiles').update({ is_active: active }).eq('id', uid);
        if (error) throw error;
        await supabase.from('admin_activity_log').insert({
          admin_id: (await supabase.auth.getUser()).data.user!.id,
          action: active ? 'activate_student' : 'block_student',
          target_type: 'student',
          target_id: uid,
        });
      }
    },
    onSuccess: (_, variables) => {
      toast.success('Student status updated');
      // Send notifications to affected students
      import('@/lib/notifications').then(({ createNotificationWithEmail, NOTIFICATION_TYPES }) => {
        for (const uid of variables.ids) {
          createNotificationWithEmail({
            userId: uid,
            type: variables.active ? NOTIFICATION_TYPES.ACCOUNT_UNBLOCKED : NOTIFICATION_TYPES.ACCOUNT_BLOCKED,
            title: variables.active ? 'Account Activated ✅' : 'Account Blocked ⚠️',
            message: variables.active
              ? 'Your account has been reactivated. You can now access all platform features.'
              : 'Your account has been temporarily blocked. Please contact support for assistance.',
            link: '/dashboard',
          });
        }
      });
      qc.invalidateQueries({ queryKey: ['admin-students'] });
      setSelectedIds(new Set());
      setConfirmAction(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: allCourses = [] } = useQuery({
    queryKey: ['all-courses-bulk'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').eq('is_published', true);
      return data ?? [];
    },
  });

  const { data: allEbooks = [] } = useQuery({
    queryKey: ['all-ebooks-bulk'],
    queryFn: async () => {
      const { data } = await supabase.from('ebooks').select('id, title').eq('is_published', true);
      return data ?? [];
    },
  });

  const bulkAssignCourse = useMutation({
    mutationFn: async (courseId: string) => {
      const ids = Array.from(selectedIds);
      const { data: existing } = await supabase.from('enrollments').select('user_id').eq('course_id', courseId).in('user_id', ids);
      const existingSet = new Set((existing ?? []).map(e => e.user_id));
      const toInsert = ids.filter(uid => !existingSet.has(uid)).map(uid => ({ user_id: uid, course_id: courseId }));
      if (toInsert.length) {
        const { error } = await supabase.from('enrollments').insert(toInsert);
        if (error) throw error;
      }
      const adminId = (await supabase.auth.getUser()).data.user!.id;
      await supabase.from('admin_activity_log').insert({ admin_id: adminId, action: 'bulk_assign_course', target_type: 'course', target_id: courseId, details: { student_count: toInsert.length, skipped: ids.length - toInsert.length } });
      return { assigned: toInsert.length, skipped: ids.length - toInsert.length };
    },
    onSuccess: (result) => {
      toast.success(`Course assigned to ${result.assigned} student(s)${result.skipped ? `, ${result.skipped} already enrolled` : ''}`);
      qc.invalidateQueries({ queryKey: ['admin-students'] });
      setBulkAssignCourseOpen(false);
      setSelectedIds(new Set());
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkAssignEbook = useMutation({
    mutationFn: async (ebookId: string) => {
      const ids = Array.from(selectedIds);
      const { data: existingOrders } = await supabase.from('orders').select('id, user_id, order_items(item_id)').in('user_id', ids).eq('status', 'completed');
      const alreadyHas = new Set<string>();
      (existingOrders ?? []).forEach((o: any) => {
        (o.order_items ?? []).forEach((i: any) => { if (i.item_id === ebookId) alreadyHas.add(o.user_id); });
      });
      const toGrant = ids.filter(uid => !alreadyHas.has(uid));
      for (const uid of toGrant) {
        const { data: order, error: oErr } = await supabase.from('orders').insert({ user_id: uid, total: 0, status: 'completed', payment_method: 'admin_grant' }).select('id').single();
        if (oErr) throw oErr;
        await supabase.from('order_items').insert({ order_id: order.id, item_id: ebookId, item_type: 'ebook', price: 0 });
      }
      const adminId = (await supabase.auth.getUser()).data.user!.id;
      await supabase.from('admin_activity_log').insert({ admin_id: adminId, action: 'bulk_assign_ebook', target_type: 'ebook', target_id: ebookId, details: { student_count: toGrant.length, skipped: ids.length - toGrant.length } });
      return { assigned: toGrant.length, skipped: ids.length - toGrant.length };
    },
    onSuccess: (result) => {
      toast.success(`Ebook assigned to ${result.assigned} student(s)${result.skipped ? `, ${result.skipped} already owned` : ''}`);
      qc.invalidateQueries({ queryKey: ['admin-students'] });
      setBulkAssignEbookOpen(false);
      setSelectedIds(new Set());
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let list = students.filter((s: any) => {
      if (statusFilter === 'active' && s.is_active === false) return false;
      if (statusFilter === 'inactive' && s.is_active !== false) return false;
      if (statusFilter === 'blocked' && s.is_active !== false) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return [s.full_name, s.roll_id, s.phone, s.university, s.department, s.campus, s.batch, s.district, s.division, s.occupation, s.company_name, s.username]
        .some(f => f?.toLowerCase().includes(q));
    });

    list.sort((a: any, b: any) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = (a.full_name || '').localeCompare(b.full_name || '');
      else if (sortBy === 'joined') cmp = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      else if (sortBy === 'spend') cmp = (a.totalSpend || 0) - (b.totalSpend || 0);
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [students, search, statusFilter, sortBy, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const activeCount = students.filter((s: any) => s.is_active !== false).length;
  const blockedCount = students.filter((s: any) => s.is_active === false).length;
  const totalRevenue = students.reduce((s: number, st: any) => s + (st.totalSpend || 0), 0);
  const now = new Date();
  const newThisMonth = students.filter((s: any) => {
    if (!s.created_at) return false;
    const d = new Date(s.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(false); }
    setPage(1);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginated.map((s: any) => s.id)));
  };

  const exportCSV = () => {
    const rows = filtered.map((s: any) => [
      s.full_name || '', s.roll_id || '', s.phone || '', s.university || '', (s.department || s.campus || ''),
      s.coursesCount, s.ebooksCount, s.totalSpend, s.certsCount, s.quizCount,
      s.is_active !== false ? 'Active' : 'Blocked',
      s.created_at ? new Date(s.created_at).toLocaleDateString() : ''
    ]);
    const header = ['Name', 'Roll ID', 'Phone', 'University', 'Department', 'Courses', 'Ebooks', 'Spend', 'Certs', 'Quizzes', 'Status', 'Joined'];
    const csv = [header, ...rows].map(r => r.map((c: any) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `students_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('CSV exported');
  };

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><Users className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{students.length}</p><p className="text-xs text-muted-foreground">Total Students</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><UserCheck className="h-8 w-8 text-green-600" /><div><p className="text-2xl font-bold">{activeCount}</p><p className="text-xs text-muted-foreground">Active</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><ShieldAlert className="h-8 w-8 text-destructive" /><div><p className="text-2xl font-bold">{blockedCount}</p><p className="text-xs text-muted-foreground">Blocked</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><CalendarPlus className="h-8 w-8 text-amber-600" /><div><p className="text-2xl font-bold">{newThisMonth}</p><p className="text-xs text-muted-foreground">New This Month</p></div></CardContent></Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">Student Management</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {students.length} students · Page {page}/{totalPages}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name, phone, university, department..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Blocked</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1" onClick={exportCSV}><Download className="h-4 w-4" /> Export</Button>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <Card className="border-primary">
          <CardContent className="p-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button size="sm" variant="destructive" className="gap-1" onClick={() => setConfirmAction({ type: 'block-bulk', ids: Array.from(selectedIds) })}>
              <Ban className="h-3.5 w-3.5" /> Block Selected
            </Button>
            <Button size="sm" variant="default" className="gap-1" onClick={() => setConfirmAction({ type: 'activate-bulk', ids: Array.from(selectedIds) })}>
              <CheckCircle className="h-3.5 w-3.5" /> Activate Selected
            </Button>
            <Button size="sm" variant="secondary" className="gap-1" onClick={() => setBulkAssignCourseOpen(true)}>
              <BookOpen className="h-3.5 w-3.5" /> Assign Course
            </Button>
            <Button size="sm" variant="secondary" className="gap-1" onClick={() => setBulkAssignEbookOpen(true)}>
              <Book className="h-3.5 w-3.5" /> Assign Ebook
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
            {paginated.map((s: any) => (
              <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/admin/students/${s.id}`)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={s.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{s.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-semibold truncate">{s.full_name || 'Unnamed'}</p>
                      <Badge variant={s.is_active !== false ? 'default' : 'destructive'} className="text-[10px] h-4 px-1">{s.is_active !== false ? 'Active' : 'Blocked'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.roll_id || 'No Roll ID'}</p>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{s.coursesCount}</span>
                      <span className="flex items-center gap-1"><Book className="h-3 w-3" />{s.ebooksCount}</span>
                      <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />৳{s.totalSpend}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={paginated.length > 0 && selectedIds.size === paginated.length} onCheckedChange={toggleSelectAll} />
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="gap-1 -ml-3" onClick={() => toggleSort('name')}>
                        Student <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Roll ID</TableHead>
                    <TableHead className="hidden lg:table-cell">Department</TableHead>
                    <TableHead className="text-center">Courses</TableHead>
                    <TableHead className="text-center">Ebooks</TableHead>
                    <TableHead className="text-center">Quizzes</TableHead>
                    <TableHead className="text-center">Certs</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="gap-1 -ml-3" onClick={() => toggleSort('spend')}>
                        Spend <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="gap-1 -ml-3" onClick={() => toggleSort('joined')}>
                        Joined <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>EduMail</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((s: any) => (
                    <TableRow key={s.id} className="hover:bg-muted/50">
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelect(s.id)} />
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => navigate(`/admin/students/${s.id}`)}>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={s.avatar_url} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{s.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{s.full_name || 'Unnamed'}</p>
                            <p className="text-xs text-muted-foreground">{s.phone || ''}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-xs">{s.roll_id || '—'}</Badge></TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[160px] truncate" title={s.department || s.campus || ''}>{s.department || s.campus || '—'}</TableCell>
                      <TableCell className="text-center">{s.coursesCount}</TableCell>
                      <TableCell className="text-center">{s.ebooksCount}</TableCell>
                      <TableCell className="text-center">{s.quizCount}</TableCell>
                      <TableCell className="text-center">{s.certsCount}</TableCell>
                      <TableCell className="font-medium">৳{s.totalSpend.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={s.is_active !== false ? 'default' : 'destructive'} className="text-xs">
                          {s.is_active !== false ? 'Active' : 'Blocked'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.institutionalEmail ? (
                          <div className="flex items-center gap-1">
                            <AtSign className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono text-xs truncate max-w-[140px]" title={s.institutionalEmail.email}>{s.institutionalEmail.email.split('@')[0]}</span>
                            <Badge variant={s.institutionalEmail.is_blocked ? 'destructive' : s.institutionalEmail.status === 'approved' ? 'default' : 'secondary'} className="text-[10px] h-4 px-1 ml-1">
                              {s.institutionalEmail.is_blocked ? 'Blocked' : s.institutionalEmail.status}
                            </Badge>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/admin/students/${s.id}`)} className="gap-2">
                              <Eye className="h-4 w-4" /> View Profile
                            </DropdownMenuItem>
                            {s.is_active !== false ? (
                              <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setConfirmAction({ type: 'block', ids: [s.id] })}>
                                <Ban className="h-4 w-4" /> Block Student
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem className="gap-2" onClick={() => setConfirmAction({ type: 'activate', ids: [s.id] })}>
                                <CheckCircle className="h-4 w-4" /> Activate Student
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {paginated.length === 0 && (
                    <TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">No students found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={open => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type.includes('block') ? 'Block Student(s)?' : 'Activate Student(s)?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type.includes('block')
                ? `This will block ${confirmAction?.ids.length} student(s). They will lose access to courses and content.`
                : `This will re-activate ${confirmAction?.ids.length} student(s).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.type.includes('block') ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => confirmAction && toggleStatus.mutate({ ids: confirmAction.ids, active: !confirmAction.type.includes('block') })}
            >
              {toggleStatus.isPending ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Assign Course Dialog */}
      <Dialog open={bulkAssignCourseOpen} onOpenChange={setBulkAssignCourseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign Course to {selectedIds.size} Student(s)</DialogTitle></DialogHeader>
          <Command className="border rounded-lg">
            <CommandInput placeholder="Search courses..." value={courseSearch} onValueChange={setCourseSearch} />
            <CommandList>
              <CommandEmpty>No courses found</CommandEmpty>
              <CommandGroup>
                {allCourses.map((c: any) => (
                  <CommandItem key={c.id} value={c.title} onSelect={() => bulkAssignCourse.mutate(c.id)} className="cursor-pointer gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span>{c.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          {bulkAssignCourse.isPending && <p className="text-sm text-muted-foreground text-center">Assigning...</p>}
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Ebook Dialog */}
      <Dialog open={bulkAssignEbookOpen} onOpenChange={setBulkAssignEbookOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign Ebook to {selectedIds.size} Student(s)</DialogTitle></DialogHeader>
          <Command className="border rounded-lg">
            <CommandInput placeholder="Search ebooks..." value={ebookSearch} onValueChange={setEbookSearch} />
            <CommandList>
              <CommandEmpty>No ebooks found</CommandEmpty>
              <CommandGroup>
                {allEbooks.map((e: any) => (
                  <CommandItem key={e.id} value={e.title} onSelect={() => bulkAssignEbook.mutate(e.id)} className="cursor-pointer gap-2">
                    <Book className="h-4 w-4 text-primary" />
                    <span>{e.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          {bulkAssignEbook.isPending && <p className="text-sm text-muted-foreground text-center">Assigning...</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
