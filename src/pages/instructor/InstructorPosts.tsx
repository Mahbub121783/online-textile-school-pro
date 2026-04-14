import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const InstructorPosts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['instructor-posts', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('posts').select('*').eq('author_id', user!.id).order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from('posts').delete().eq('id', id); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['instructor-posts'] }); toast.success('Post deleted'); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading text-2xl font-bold">My Blog Posts</h2>
        <Button onClick={() => navigate('/instructor/posts/new')}>
          <Plus className="h-4 w-4 mr-2" /> New Post
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
          ) : posts.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No posts yet. Create your first post!</TableCell></TableRow>
          ) : posts.map((post: any) => (
            <TableRow key={post.id}>
              <TableCell className="font-medium">{post.title}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{post.category || '—'}</TableCell>
              <TableCell><Badge variant={post.status === 'published' ? 'default' : 'secondary'}>{post.status}</Badge></TableCell>
              <TableCell className="text-sm text-muted-foreground">{post.published_at ? format(new Date(post.published_at), 'dd MMM yyyy') : format(new Date(post.created_at), 'dd MMM yyyy')}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => navigate(`/instructor/posts/${post.id}/edit`)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => window.open(`/blog/${post.slug}`, '_blank')}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(post.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default InstructorPosts;
