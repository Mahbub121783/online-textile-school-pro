import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Star, Loader2, Trash2, MessageSquareText } from 'lucide-react';

interface CampusReviewsProps {
  campusId: string;
}

const StarRow = ({ value, onChange, size = 'h-5 w-5' }: { value: number; onChange?: (v: number) => void; size?: string }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} className={onChange ? 'cursor-pointer' : 'cursor-default'}>
        <Star className={`${size} ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
      </button>
    ))}
  </div>
);

/**
 * Campus reviews -- new feature (db/62). Always public-read, no manage/public
 * split like NoticeBoard: any signed-in user can post/edit exactly one review
 * for a campus (UNIQUE(campus_id, user_id)), admin can moderate/delete any.
 */
const CampusReviews = ({ campusId }: CampusReviewsProps) => {
  const { user, roles, isSuperAdmin } = useAuth();
  const isAdmin = isSuperAdmin || roles?.includes('admin');
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState('');

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['campus-reviews', campusId],
    enabled: !!campusId,
    refetchInterval: 45000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campus_reviews')
        .select('*, author:user_profiles(full_name, avatar_url)')
        .eq('campus_id', campusId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const myReview = reviews.find((r: any) => r.user_id === user?.id);
  const avgRating = reviews.length ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length : 0;

  const startEditing = () => {
    setDraftRating(myReview?.rating || 0);
    setDraftComment(myReview?.comment || '');
    setEditing(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('campus_reviews').upsert(
        { campus_id: campusId, user_id: user!.id, rating: draftRating, comment: draftComment.trim() || null },
        { onConflict: 'campus_id,user_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campus-reviews', campusId] });
      toast.success('Review saved');
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campus_reviews').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campus-reviews', campusId] });
      toast.success('Review removed');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-heading font-bold flex items-center gap-2"><MessageSquareText className="h-4 w-4" /> Reviews</h3>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <StarRow value={Math.round(avgRating)} size="h-4 w-4" />
            <span className="text-sm font-semibold tabular-nums">{avgRating.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">({reviews.length})</span>
          </div>
        )}
      </div>

      {user && (
        <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
          {editing ? (
            <>
              <StarRow value={draftRating} onChange={setDraftRating} />
              <Textarea placeholder="Share your experience..." rows={3} value={draftComment} onChange={(e) => setDraftComment(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                <Button type="button" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || draftRating === 0}>
                  {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  {myReview ? 'Update Review' : 'Post Review'}
                </Button>
              </div>
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={startEditing}>
              {myReview ? 'Edit Your Review' : 'Write a Review'}
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
      ) : reviews.length === 0 ? (
        <p className="text-xs text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="space-y-2">
          {reviews.map((r: any) => (
            <div key={r.id} className="border rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{r.author?.full_name || 'Student'}</p>
                    <StarRow value={r.rating} size="h-3.5 w-3.5" />
                  </div>
                  {r.comment && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{r.comment}</p>}
                  <p className="text-[11px] text-muted-foreground/70 mt-1">{format(new Date(r.created_at), 'dd MMM yyyy')}</p>
                </div>
                {(isAdmin || r.user_id === user?.id) && (
                  <Button
                    type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                    onClick={() => { if (confirm('Delete this review?')) deleteMutation.mutate(r.id); }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CampusReviews;
