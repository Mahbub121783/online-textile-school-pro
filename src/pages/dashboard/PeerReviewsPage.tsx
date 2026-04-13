import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Star, ClipboardCheck, Send } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { createNotification } from '@/lib/notifications';

const PeerReviewsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeFeedback, setActiveFeedback] = useState<Record<string, { feedback: string; rating: number }>>({});

  // Peer reviews assigned to me (submissions I need to review)
  const { data: assignedReviews = [], isLoading } = useQuery({
    queryKey: ['my-peer-reviews', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('peer_reviews')
        .select(`
          *,
          assignment_submissions!peer_reviews_submission_id_fkey(
            id, submission_text, file_url, user_id,
            assignments!assignment_submissions_assignment_id_fkey(title, course_id)
          ),
          courses!peer_reviews_course_id_fkey(title)
        `)
        .eq('reviewer_id', user!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  // Reviews received on my submissions
  const { data: receivedReviews = [] } = useQuery({
    queryKey: ['received-peer-reviews', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: mySubmissions } = await supabase
        .from('assignment_submissions')
        .select('id')
        .eq('user_id', user!.id);
      if (!mySubmissions?.length) return [];
      const subIds = mySubmissions.map(s => s.id);
      const { data } = await supabase
        .from('peer_reviews')
        .select('*, user_profiles:reviewer_id(full_name)')
        .in('submission_id', subIds)
        .not('feedback', 'is', null)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const submitReview = useMutation({
    mutationFn: async ({ reviewId, feedback, rating, submissionUserId, assignmentTitle }: {
      reviewId: string; feedback: string; rating: number; submissionUserId: string; assignmentTitle: string;
    }) => {
      const { error } = await supabase
        .from('peer_reviews')
        .update({ feedback, rating } as any)
        .eq('id', reviewId);
      if (error) throw error;

      await createNotification({
        userId: submissionUserId,
        type: 'system',
        title: 'Peer Review Received',
        message: `Your submission for "${assignmentTitle}" received a peer review.`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-peer-reviews'] });
      toast.success('Peer review submitted!');
    },
  });

  const pendingReviews = assignedReviews.filter((r: any) => !r.feedback);
  const completedReviews = assignedReviews.filter((r: any) => r.feedback);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Peer Reviews</h1>
        <p className="text-sm text-muted-foreground">Review your peers' assignments and see feedback on yours</p>
      </div>

      {/* Pending reviews to do */}
      <div>
        <h2 className="font-heading text-lg font-semibold mb-3 flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Assigned to Review ({pendingReviews.length})
        </h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
        ) : pendingReviews.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No pending peer reviews.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {pendingReviews.map((review: any) => {
              const submission = review.assignment_submissions;
              const assignment = submission?.assignments;
              const fb = activeFeedback[review.id] || { feedback: '', rating: 3 };
              return (
                <Card key={review.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{assignment?.title || 'Assignment'}</p>
                        <p className="text-xs text-muted-foreground">{review.courses?.title || 'Course'}</p>
                      </div>
                      <Badge variant="outline" className="text-warning border-warning">Pending</Badge>
                    </div>

                    {submission?.submission_text && (
                      <div className="bg-muted/30 p-3 rounded-md text-sm max-h-40 overflow-y-auto">
                        {submission.submission_text}
                      </div>
                    )}
                    {submission?.file_url && (
                      <a href={submission.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View submitted file →</a>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground mr-1">Rating:</span>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <button key={i} onClick={() => setActiveFeedback(p => ({ ...p, [review.id]: { ...fb, rating: i + 1 } }))}>
                            <Star className={`h-4 w-4 ${i < fb.rating ? 'fill-warning text-warning' : 'text-muted'}`} />
                          </button>
                        ))}
                      </div>
                      <Textarea
                        placeholder="Write your feedback..."
                        value={fb.feedback}
                        onChange={(e) => setActiveFeedback(p => ({ ...p, [review.id]: { ...fb, feedback: e.target.value } }))}
                        rows={3}
                      />
                      <Button
                        size="sm"
                        disabled={!fb.feedback.trim() || submitReview.isPending}
                        onClick={() => submitReview.mutate({
                          reviewId: review.id,
                          feedback: fb.feedback,
                          rating: fb.rating,
                          submissionUserId: submission?.user_id,
                          assignmentTitle: assignment?.title || 'Assignment',
                        })}
                        className="gap-1"
                      >
                        <Send className="h-3.5 w-3.5" /> Submit Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Reviews I received */}
      {receivedReviews.length > 0 && (
        <div>
          <h2 className="font-heading text-lg font-semibold mb-3">Reviews Received ({receivedReviews.length})</h2>
          <div className="space-y-3">
            {receivedReviews.map((review: any) => (
              <Card key={review.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{(review.user_profiles as any)?.full_name || 'Peer'}</p>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < (review.rating || 0) ? 'fill-warning text-warning' : 'text-muted'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{review.feedback}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">{format(new Date(review.created_at), 'MMM dd, yyyy')}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed reviews by me */}
      {completedReviews.length > 0 && (
        <div>
          <h2 className="font-heading text-lg font-semibold mb-3">My Completed Reviews ({completedReviews.length})</h2>
          <div className="space-y-3">
            {completedReviews.map((review: any) => (
              <Card key={review.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{review.assignment_submissions?.assignments?.title || 'Assignment'}</p>
                    <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]">Done</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{review.feedback}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PeerReviewsPage;
