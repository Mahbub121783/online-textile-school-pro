import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

const AdminActivity = () => {
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-activity-log', page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const { data: logs, count } = await supabase
        .from('admin_activity_log' as any)
        .select('*, user_profiles!admin_activity_log_admin_id_fkey(full_name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      return { logs: logs ?? [], total: count ?? 0 };
    },
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">Activity Log</h2>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : data?.logs.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No activity recorded yet.</TableCell></TableRow>
              ) : (
                data?.logs.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.user_profiles?.full_name || a.admin_id?.slice(0, 8)}</TableCell>
                    <TableCell><Badge variant="outline">{a.action}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.target_type && <span>{a.target_type}: {a.target_id?.slice(0, 8)}</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.created_at ? format(new Date(a.created_at), 'MMM d, yyyy HH:mm') : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminActivity;
