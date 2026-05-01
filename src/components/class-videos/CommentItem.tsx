import { useState } from 'react';
import { Heart, Reply, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCommentLike, usePostComment, useDeleteComment, type VideoComment } from '@/hooks/useVideoComments';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  comment: VideoComment;
  videoId: string;
  isReply?: boolean;
}

export default function CommentItem({ comment, videoId, isReply }: Props) {
  const { user } = useAuth();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const { isLiked, toggle } = useCommentLike(comment.id, videoId);
  const post = usePostComment(videoId);
  const del = useDeleteComment(videoId);

  const initials = (comment.author?.full_name || 'U').slice(0, 2).toUpperCase();
  const isOwn = user?.id === comment.user_id;

  const handleReply = async () => {
    if (!replyText.trim()) return;
    await post.mutateAsync({ content: replyText, parentId: comment.id });
    setReplyText('');
    setReplyOpen(false);
  };

  return (
    <div className={`flex gap-3 ${isReply ? 'ml-10 mt-3' : ''}`}>
      <Avatar className={isReply ? 'h-7 w-7' : 'h-9 w-9'}>
        <AvatarImage src={comment.author?.avatar_url || undefined} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-sm">{comment.author?.full_name || 'User'}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{comment.content}</p>
        <div className="flex items-center gap-1 mt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => user && toggle.mutate(isLiked)}
            disabled={!user || toggle.isPending}
          >
            <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-current text-primary' : ''}`} />
            {comment.likes_count > 0 ? comment.likes_count : ''}
          </Button>
          {!isReply && user && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setReplyOpen((v) => !v)}
            >
              <Reply className="h-3.5 w-3.5" /> Reply
            </Button>
          )}
          {isOwn && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm('Delete this comment?')) del.mutate(comment.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {replyOpen && (
          <div className="mt-2 space-y-2">
            <Textarea
              placeholder="Write a reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={2}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleReply} disabled={post.isPending || !replyText.trim()}>
                Reply
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setReplyOpen(false); setReplyText(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 space-y-3">
            {comment.replies.map((r) => (
              <CommentItem key={r.id} comment={r} videoId={videoId} isReply />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
