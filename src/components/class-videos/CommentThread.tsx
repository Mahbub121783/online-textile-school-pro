import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useVideoComments, usePostComment } from '@/hooks/useVideoComments';
import { useAuth } from '@/hooks/useAuth';
import CommentItem from './CommentItem';
import { CommentSkeletonList } from './CommentSkeleton';
import { MessageSquare, Send } from 'lucide-react';

interface Props {
  videoId: string;
  /** When true, renders with a sticky bottom composer suited for sheets. */
  sticky?: boolean;
}

export default function CommentThread({ videoId, sticky }: Props) {
  const { user } = useAuth();
  const { data: comments, isLoading } = useVideoComments(videoId);
  const post = usePostComment(videoId);
  const [text, setText] = useState('');

  const submit = async () => {
    if (!text.trim()) return;
    await post.mutateAsync({ content: text });
    setText('');
  };

  const list = (
    <>
      <h2 className="text-base font-bold flex items-center gap-2 mb-4">
        <MessageSquare className="h-4 w-4" />
        {comments?.length ?? 0} Comments
      </h2>

      {isLoading ? (
        <CommentSkeletonList count={5} />
      ) : !comments || comments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">
          Be the first to comment!
        </p>
      ) : (
        <div className="space-y-5">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} videoId={videoId} />
          ))}
        </div>
      )}
    </>
  );

  const composer = user ? (
    <div className="flex gap-2 items-end">
      <Textarea
        placeholder="Add a comment..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={1}
        className="resize-none min-h-[40px] max-h-32"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <Button
        size="icon"
        onClick={submit}
        disabled={!text.trim() || post.isPending}
        aria-label="Post comment"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  ) : (
    <div className="p-3 rounded-lg border bg-muted/30 text-sm text-muted-foreground text-center">
      <Link to="/login" className="text-primary font-medium hover:underline">Login</Link> to like and comment.
    </div>
  );

  if (sticky) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto pr-1 -mr-1">
          {list}
        </div>
        <div className="pt-3 mt-2 border-t bg-background sticky bottom-0 pb-[env(safe-area-inset-bottom)]">
          {composer}
        </div>
      </div>
    );
  }

  return (
    <section className="mt-8">
      {list}
      <div className="mt-6">{composer}</div>
    </section>
  );
}
