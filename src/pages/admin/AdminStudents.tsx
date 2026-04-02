import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, BookOpen, Book, DollarSign } from 'lucide-react';

export default function AdminStudents() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['admin-students'],
    queryFn: async () => {
      // Get all student user_ids
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');
      if (!roles?.length) return [];

      const userIds = roles.map(r => r.user_id);

      // Get profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('*')
        .in('id', userIds);

      // Get enrollment counts
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('user_id')
        .in('user_id', userIds);

      // Get order totals with ebook counts
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('order_id, item_type, price')
        .eq('item_type', 'ebook');

      const { data: orders } = await supabase
        .from('orders')
        .select('id, user_id, total, status')
        .in('user_id', userIds)
        .eq('status', 'completed');

      const orderIds = new Set((orders ?? []).map(o => o.id));
      const ebookCountMap: Record<string, number> = {};
      (orderItems ?? []).forEach(oi => {
        if (orderIds.has(oi.order_id)) {
          const order = (orders ?? []).find(o => o.id === oi.order_id);
          if (order) {
            ebookCountMap[order.user_id] = (ebookCountMap[order.user_id] || 0) + 1;
          }
        }
      });

      const enrollCountMap: Record<string, number> = {};
      (enrollments ?? []).forEach(e => {
        enrollCountMap[e.user_id] = (enrollCountMap[e.user_id] || 0) + 1;
      });

      const spendMap: Record<string, number> = {};
      (orders ?? []).forEach(o => {
        spendMap[o.user_id] = (spendMap[o.user_id] || 0) + (o.total || 0);
      });

      return (profiles ?? []).map(p => ({
        ...p,
        coursesCount: enrollCountMap[p.id] || 0,
        ebooksCount: ebookCountMap[p.id] || 0,
        totalSpend: spendMap[p.id] || 0,
      }));
    },
  });

  const filtered = students.filter((s: any) =>
    !search || s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">Student Management</h1>
          <p className="text-sm text-muted-foreground">{students.length} total students</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or Roll ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
                    <p className="font-semibold truncate">{s.full_name || 'Unnamed'}</p>
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
                    <TableHead>Student</TableHead>
                    <TableHead>Roll ID</TableHead>
                    <TableHead className="text-center">Courses</TableHead>
                    <TableHead className="text-center">Ebooks</TableHead>
                    <TableHead className="text-right">Total Spend</TableHead>
                    <TableHead>Joined</TableHead>
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
                      <TableCell className="text-right font-medium">৳{s.totalSpend.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No students found</TableCell></TableRow>
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