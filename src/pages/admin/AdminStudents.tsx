import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, BookOpen, Book, DollarSign, Users, UserCheck, FileQuestion, Award, ArrowUpDown } from 'lucide-react';

type SortKey = 'name' | 'joined' | 'spend';

export default function AdminStudents() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('joined');
  const [sortAsc, setSortAsc] = useState(false);
  const navigate = useNavigate();

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['admin-students'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'student');
      if (!roles?.length) return [];
      const userIds = roles.map(r => r.user_id);

      const { data: profiles } = await supabase.from('user_profiles').select('*').in('id', userIds);
      const { data: enrollments } = await supabase.from('enrollments').select('user_id').in('user_id', userIds);
      const { data: orders } = await supabase.from('orders').select('id, user_id, total, status').in('user_id', userIds).eq('status', 'completed');
      const { data: orderItems } = await supabase.from('order_items').select('order_id, item_type').eq('item_type', 'ebook');
      const { data: certs } = await supabase.from('certificates').select('user_id').in('user_id', userIds);
      const { data: quizAttempts } = await supabase.from('quiz_attempts').select('user_id').in('user_id', userIds);

      const orderIds = new Set((orders ?? []).map(o => o.id));
      const ebookCountMap: Record<string, number> = {};
      (orderItems ?? []).forEach(oi => {
        if (orderIds.has(oi.order_id)) {
          const order = (orders ?? []).find(o => o.id === oi.order_id);
          if (order) ebookCountMap[order.user_id] = (ebookCountMap[order.user_id] || 0) + 1;
        }
      });

      const enrollCountMap: Record<string, number> = {};
      (enrollments ?? []).forEach(e => { enrollCountMap[e.user_id] = (enrollCountMap[e.user_id] || 0) + 1; });

      const spendMap: Record<string, number> = {};
      (orders ?? []).forEach(o => { spendMap[o.user_id] = (spendMap[o.user_id] || 0) + (o.total || 0); });

      const certCountMap: Record<string, number> = {};
      (certs ?? []).forEach(c => { certCountMap[c.user_id] = (certCountMap[c.user_id] || 0) + 1; });

      const quizCountMap: Record<string, number> = {};
      (quizAttempts ?? []).forEach(q => { quizCountMap[q.user_id] = (quizCountMap[q.user_id] || 0) + 1; });

      return (profiles ?? []).map(p => ({
        ...p,
        coursesCount: enrollCountMap[p.id] || 0,
        ebooksCount: ebookCountMap[p.id] || 0,
        totalSpend: spendMap[p.id] || 0,
        certsCount: certCountMap[p.id] || 0,
        quizCount: quizCountMap[p.id] || 0,
      }));
    },
  });

  const filtered = useMemo(() => {
    let list = students.filter((s: any) => {
      if (statusFilter === 'active' && s.is_active === false) return false;
      if (statusFilter === 'inactive' && s.is_active !== false) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return s.full_name?.toLowerCase().includes(q) || s.roll_id?.toLowerCase().includes(q) || s.phone?.toLowerCase().includes(q);
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

  const activeCount = students.filter((s: any) => s.is_active !== false).length;
  const totalRevenue = students.reduce((s: number, st: any) => s + (st.totalSpend || 0), 0);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(false); }
  };

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><Users className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{students.length}</p><p className="text-xs text-muted-foreground">Total Students</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><UserCheck className="h-8 w-8 text-green-600" /><div><p className="text-2xl font-bold">{activeCount}</p><p className="text-xs text-muted-foreground">Active</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><DollarSign className="h-8 w-8 text-amber-600" /><div><p className="text-2xl font-bold">৳{totalRevenue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Revenue</p></div></CardContent></Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">Student Management</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {students.length} students</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name, roll ID, phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading students...</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
            {filtered.map((s: any) => (
              <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/admin/students/${s.id}`)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={s.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{s.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-semibold truncate">{s.full_name || 'Unnamed'}</p>
                      <Badge variant={s.is_active !== false ? 'default' : 'destructive'} className="text-[10px] h-4 px-1">{s.is_active !== false ? '●' : '○'}</Badge>
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
                    <TableHead>
                      <Button variant="ghost" size="sm" className="gap-1 -ml-3" onClick={() => toggleSort('name')}>
                        Student <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Roll ID</TableHead>
                    <TableHead className="text-center">Courses</TableHead>
                    <TableHead className="text-center">Ebooks</TableHead>
                    <TableHead className="text-center">Quizzes</TableHead>
                    <TableHead className="text-center">Certs</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="gap-1 -ml-3" onClick={() => toggleSort('spend')}>
                        Total Spend <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="gap-1 -ml-3" onClick={() => toggleSort('joined')}>
                        Joined <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s: any) => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/students/${s.id}`)}>
                      <TableCell>
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
                      <TableCell className="text-center">{s.coursesCount}</TableCell>
                      <TableCell className="text-center">{s.ebooksCount}</TableCell>
                      <TableCell className="text-center">{s.quizCount}</TableCell>
                      <TableCell className="text-center">{s.certsCount}</TableCell>
                      <TableCell className="font-medium">৳{s.totalSpend.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={s.is_active !== false ? 'default' : 'destructive'} className="text-xs">
                          {s.is_active !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No students found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}