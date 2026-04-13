import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, FileText, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const AdminResearchPapers = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filter, setFilter] = useState<string>('all');

  const { data: papers = [], isLoading } = useQuery({
    queryKey: ['admin-research-papers', filter],
    queryFn: async () => {
      let q = supabase
        .from('research_papers')
        .select('*, user_profiles:submitted_by(full_name)')
        .order('created_at', { ascending: false });
      if (filter === 'pending') q = q.eq('is_approved', false);
      if (filter === 'approved') q = q.eq('is_approved', true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.from('research_papers').update({
        is_approved: approved,
        published_date: approved ? new Date().toISOString().split('T')[0] : null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-research-papers'] });
      toast.success('Paper status updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('research_papers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-research-papers'] });
      toast.success('Paper deleted');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Research Papers</h1>
          <p className="text-sm text-muted-foreground">Review and manage submitted research papers</p>
        </div>
        <div className="flex gap-2">
          {['all', 'pending', 'approved'].map(f => (
            <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead>Downloads</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 animate-pulse text-muted-foreground">Loading...</TableCell></TableRow>
              ) : papers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted" />No research papers.
                </TableCell></TableRow>
              ) : (
                papers.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">{p.title}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{p.category || '—'}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.user_profiles?.full_name || '—'}</TableCell>
                    <TableCell className="text-sm">{p.download_count}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_approved ? 'default' : 'secondary'} className="text-[10px]">
                        {p.is_approved ? 'Approved' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {!p.is_approved && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => approveMutation.mutate({ id: p.id, approved: true })}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {p.is_approved && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" onClick={() => approveMutation.mutate({ id: p.id, approved: false })}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {p.file_url && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={p.file_url} target="_blank" rel="noopener noreferrer"><FileText className="h-3.5 w-3.5" /></a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
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
    </div>
  );
};

export default AdminResearchPapers;
