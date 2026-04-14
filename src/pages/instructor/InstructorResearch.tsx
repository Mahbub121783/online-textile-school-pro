import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Star, Check, X, MessageSquare, Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';

const InstructorResearch = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<any>(null);
  const [reviewForm, setReviewForm] = useState({ rating: '4', feedback: '', decision: 'approved' });

  // Papers assigned for review
  const { data: assignedPapers = [] } = useQuery({
    queryKey: ['instructor-review-papers', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('research_papers')
        .select('*, user_profiles:submitted_by(full_name)')
        .eq('reviewer_id', user!.id)
        .in('status', ['under_review', 'submitted'])
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  // Papers submitted by instructor's students
  const { data: studentPapers = [] } = useQuery({
    queryKey: ['instructor-student-papers', user?.id],
    queryFn: async () => {
      // Get instructor's course student IDs
      const { data: courses } = await supabase.from('courses').select('id').eq('instructor_id', user!.id);
      if (!courses?.length) return [];
      const courseIds = courses.map(c => c.id);
      const { data: enrollments } = await supabase.from('enrollments').select('user_id').in('course_id', courseIds);
      if (!enrollments?.length) return [];
      const studentIds = [...new Set(enrollments.map(e => e.user_id))];
      const { data } = await supabase
        .from('research_papers')
        .select('*, user_profiles:submitted_by(full_name)')
        .in('submitted_by', studentIds)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  // My reviews
  const { data: myReviews = [] } = useQuery({
    queryKey: ['instructor-reviews', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('research_paper_reviews')
        .select('*, research_papers(title)')
        .eq('reviewer_id', user!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      // Insert review
      const { error: revErr } = await supabase.from('research_paper_reviews').insert({
        paper_id: selectedPaper.id,
        reviewer_id: user!.id,
        status: 'completed',
        rating: parseInt(reviewForm.rating),
        feedback: reviewForm.feedback,
      });
      if (revErr) throw revErr;

      // Update paper status
      const { error: papErr } = await supabase.from('research_papers').update({
        status: reviewForm.decision,
        reviewer_feedback: reviewForm.feedback,
      }).eq('id', selectedPaper.id);
      if (papErr) throw papErr;

      // Notify author
      if (selectedPaper.submitted_by) {
        await supabase.from('notifications').insert({
          user_id: selectedPaper.submitted_by,
          type: 'research',
          title: `Paper ${reviewForm.decision === 'approved' ? 'Approved' : reviewForm.decision === 'rejected' ? 'Rejected' : 'Revision Requested'}`,
          message: `Your paper "${selectedPaper.title}" has been ${reviewForm.decision.replace('_', ' ')}.`,
          link: '/dashboard/my-research',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-review-papers'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-reviews'] });
      setReviewOpen(false);
      toast.success('Review submitted!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openReview = (paper: any) => {
    setSelectedPaper(paper);
    setReviewForm({ rating: '4', feedback: '', decision: 'approved' });
    setReviewOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Research Papers</h1>
          <p className="text-sm text-muted-foreground">Review papers and manage submissions</p>
        </div>
        <Button onClick={() => navigate('/research/submit')} className="gap-1">
          <Plus className="h-4 w-4" /> Submit Paper
        </Button>
      </div>

      <Tabs defaultValue="review">
        <TabsList>
          <TabsTrigger value="review">Assigned Reviews ({assignedPapers.length})</TabsTrigger>
          <TabsTrigger value="students">Student Papers ({studentPapers.length})</TabsTrigger>
          <TabsTrigger value="history">Review History ({myReviews.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="mt-4">
          {assignedPapers.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-3 text-muted" />
              <p className="text-muted-foreground">No papers assigned for review</p>
            </CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedPapers.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate">{p.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.user_profiles?.full_name || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{p.category || '—'}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right space-x-1">
                          {p.file_url && (
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => navigate(`/research/${p.id}/read`)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="default" size="sm" className="h-8 gap-1" onClick={() => openReview(p)}>
                            <MessageSquare className="h-3.5 w-3.5" /> Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          {studentPapers.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No papers from your students</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentPapers.map((p: any) => (
                      <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/research/${p.id}`)}>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate">{p.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.user_profiles?.full_name || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{p.status.replace('_', ' ')}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {myReviews.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No review history</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {myReviews.map((r: any) => (
                <Card key={r.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{r.research_papers?.title || 'Unknown'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`h-3 w-3 ${i < (r.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-muted'}`} />
                            ))}
                          </div>
                          <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    {r.feedback && <p className="text-xs text-muted-foreground mt-2">{r.feedback}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Review: {selectedPaper?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rating (1-5)</Label>
              <Select value={reviewForm.rating} onValueChange={v => setReviewForm(f => ({ ...f, rating: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} Star{n > 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Feedback</Label>
              <Textarea value={reviewForm.feedback}
                onChange={e => setReviewForm(f => ({ ...f, feedback: e.target.value }))}
                rows={4} placeholder="Provide detailed feedback..." />
            </div>
            <div>
              <Label>Decision</Label>
              <Select value={reviewForm.decision} onValueChange={v => setReviewForm(f => ({ ...f, decision: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approve</SelectItem>
                  <SelectItem value="revision_requested">Request Revision</SelectItem>
                  <SelectItem value="rejected">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button onClick={() => submitReviewMutation.mutate()} disabled={submitReviewMutation.isPending}>
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstructorResearch;
