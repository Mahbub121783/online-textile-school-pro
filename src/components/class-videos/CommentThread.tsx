import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useVideoComments, usePostComment } from '@/hooks/useVideoComments';
import { useAuth } from '@/hooks/useAuth';
import CommentItem from './CommentItem';
import { MessageSquare } from 'lucide-react';

export default function CommentThread({ videoId }: { videoId: string }) {
  const { user } = useAuth();
  const { data: comments, isLoading } = useVideoComments(videoId);
  const post = usePostComment(videoId);
  const [text, setText] = useState('');

  const submit = async () => {
    if (!text.trim()) return;
    await post.mutateAsync({ content: text });
    setText('');
  };

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5" />
        {comments?.length ?? 0} Comments
      </h2>

      {user ? (
        <div className="mb-6 space-y-2">
          <Textarea
            placeholder="Add a comment..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setText('')}
              disabled={!text}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={!text.trim() || post.isPending}>
              {post.isPending ? 'Posting...' : 'Comment'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
          <Link to="/login" className="text-primary font-medium hover:underline">Login</Link> to like and comment.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !comments || comments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Be the first to comment!
        </p>
      ) : (
        <div className="space-y-5">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} videoId={videoId} />
          ))}
        </div>
      )}
    </section>
  );
}
