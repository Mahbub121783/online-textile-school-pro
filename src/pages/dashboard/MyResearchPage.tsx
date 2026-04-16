import { CardGridSkeleton } from '@/components/ui/loading-skeletons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Plus, Eye, Download, BookmarkCheck, Edit2, ExternalLink, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  revision_requested: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const MyResearchPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: myPapers = [], isLoading } = useQuery({
    queryKey: ['my-research-papers', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('research_papers')
        .select('*')
        .eq('submitted_by', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: bookmarks = [] } = useQuery({
    queryKey: ['my-research-bookmarks', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('research_paper_bookmarks')
        .select('*, research_papers(id, title, authors, category, status, download_count, view_count)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('research_papers').delete().eq('id', id).eq('submitted_by', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-research-papers'] });
      toast.success('Paper deleted');
    },
  });

  const stats = {
    total: myPapers.length,
    published: myPapers.filter((p: any) => p.status === 'approved').length,
    pending: myPapers.filter((p: any) => ['submitted', 'under_review'].includes(p.status)).length,
    totalViews: myPapers.reduce((s: number, p: any) => s + (p.view_count || 0), 0),
    totalDownloads: myPapers.reduce((s: number, p: any) => s + (p.download_count || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">My Research</h1>
          <p className="text-sm text-muted-foreground">Manage your papers and track submissions</p>
        </div>
        <Button onClick={() => navigate('/research/submit')} className="gap-1">
          <Plus className="h-4 w-4" /> Submit Paper
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Papers', value: stats.total, icon: FileText },
          { label: 'Published', value: stats.published, icon: FileText },
          { label: 'Pending', value: stats.pending, icon: FileText },
          { label: 'Total Views', value: stats.totalViews, icon: Eye },
          { label: 'Downloads', value: stats.totalDownloads, icon: Download },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <s.icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="papers">
        <TabsList>
          <TabsTrigger value="papers">My Papers ({myPapers.length})</TabsTrigger>
          <TabsTrigger value="library">Library ({bookmarks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="papers" className="space-y-3 mt-4">
          {isLoading ? (
            <CardGridSkeleton count={3} columns={3} />
          ) : myPapers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-3 text-muted" />
                <p className="text-muted-foreground mb-3">You haven't submitted any papers yet</p>
                <Button onClick={() => navigate('/research/submit')}>Submit Your First Paper</Button>
              </CardContent>
            </Card>
          ) : (
            myPapers.map((p: any) => (
              <Card key={p.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`text-[10px] ${statusColors[p.status] || ''}`}>
                          {p.status.replace('_', ' ')}
                        </Badge>
                        {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                      </div>
                      <h3 className="font-heading font-semibold text-sm truncate">{p.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(p.created_at).toLocaleDateString()} · {p.view_count} views · {p.download_count} downloads
                      </p>
                      {p.status === 'revision_requested' && p.reviewer_feedback && (
                        <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-950 rounded text-xs border border-orange-200 dark:border-orange-800">
                          <p className="font-medium text-orange-800 dark:text-orange-200 mb-1">Revision Requested:</p>
                          <p className="text-orange-700 dark:text-orange-300">{p.reviewer_feedback}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {p.status === 'draft' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/research/submit')}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {p.status === 'approved' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/research/${p.id}`)}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {p.status === 'draft' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => deleteMutation.mutate(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="library" className="space-y-3 mt-4">
          {bookmarks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookmarkCheck className="h-12 w-12 mx-auto mb-3 text-muted" />
                <p className="text-muted-foreground">No bookmarked papers</p>
              </CardContent>
            </Card>
          ) : (
            bookmarks.map((b: any) => (
              <Card key={b.id} className="hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => navigate(`/research/${b.research_papers?.id}`)}>
                <CardContent className="p-4">
                  <h3 className="font-heading font-semibold text-sm">{b.research_papers?.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Array.isArray(b.research_papers?.authors) ? b.research_papers.authors.map((a: any) => a.name).join(', ') : ''}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyResearchPage;
