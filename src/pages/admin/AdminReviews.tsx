import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, CheckCircle2, XCircle, MessageSquare, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { createNotification } from '@/lib/notifications';

const AdminReviews = () => {
  const queryClient = useQueryClient();
  const [responseTexts, setResponseTexts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('pending');

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['admin-reviews', activeTab],
    queryFn: async () => {
      let query = supabase
        .from('reviews')
        .select('*, user_profiles!reviews_user_id_fkey(full_name, avatar_url), courses!reviews_course_id_fkey(title, slug)')
        .order('created_at', { ascending: false });

      if (activeTab === 'pending') query = query.is('is_approved', null);
      else if (activeTab === 'approved') query = query.eq('is_approved', true);
      else if (activeTab === 'rejected') query = query.eq('is_approved', false);

      const { data } = await query;
      return data ?? [];
    },
  });

  const moderateReview = useMutation({
    mutationFn: async ({ reviewId, approved, adminResponse, userId, courseTitle }: {
      reviewId: string; approved: boolean; adminResponse?: string; userId: string; courseTitle: string;
    }) => {
      const { error } = await supabase
        .from('reviews')
        .update({ is_approved: approved, admin_response: adminResponse || null } as any)
        .eq('id', reviewId);
      if (error) throw error;

      await createNotification({
        userId,
        type: 'system',
        title: approved ? 'Review Approved' : 'Review Rejected',
        message: `Your review for "${courseTitle}" has been ${approved ? 'approved' : 'rejected'}.`,
        link: `/courses/${(reviews.find((r: any) => r.id === reviewId) as any)?.courses?.slug || ''}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success('Review moderated successfully');
    },
  });

  const pendingCount = reviews.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Review Management</h1>
        <p className="text-sm text-muted-foreground">Approve, reject, and respond to course reviews</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="h-3.5 w-3.5" /> Pending
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1">
            <XCircle className="h-3.5 w-3.5" /> Rejected
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Loading reviews...</p>
          ) : reviews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted" />
                <p>No {activeTab} reviews found.</p>
              </CardContent>
            </Card>
          ) : (
            reviews.map((review: any) => (
              <Card key={review.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                        {review.user_profiles?.full_name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{review.user_profiles?.full_name || 'Student'}</p>
                        <p className="text-xs text-muted-foreground">
                          on <span className="font-medium text-foreground">{review.courses?.title || 'Unknown Course'}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? 'fill-warning text-warning' : 'text-muted'}`} />
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {format(new Date(review.created_at), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>

                  {review.comment && (
                    <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">{review.comment}</p>
                  )}

                  {review.admin_response && (
                    <div className="bg-primary/5 border-l-2 border-primary p-3 rounded-r-md">
                      <p className="text-[10px] font-semibold text-primary mb-1">Admin Response</p>
                      <p className="text-sm text-muted-foreground">{review.admin_response}</p>
                    </div>
                  )}

                  {activeTab === 'pending' && (
                    <>
                      <Textarea
                        placeholder="Add an admin response (optional)..."
                        value={responseTexts[review.id] || ''}
                        onChange={(e) => setResponseTexts(p => ({ ...p, [review.id]: e.target.value }))}
                        className="text-sm"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => moderateReview.mutate({
                            reviewId: review.id,
                            approved: true,
                            adminResponse: responseTexts[review.id],
                            userId: review.user_id,
                            courseTitle: review.courses?.title || 'Course',
                          })}
                          disabled={moderateReview.isPending}
                          className="gap-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => moderateReview.mutate({
                            reviewId: review.id,
                            approved: false,
                            adminResponse: responseTexts[review.id],
                            userId: review.user_id,
                            courseTitle: review.courses?.title || 'Course',
                          })}
                          disabled={moderateReview.isPending}
                          className="gap-1"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminReviews;
