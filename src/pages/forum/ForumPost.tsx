import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Lock, Pin, Trash2, MessageSquare, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import SEOHead from '@/components/SEOHead';

const EMOJIS = ['❤️', '👍', '🎉', '🔥', '💡'];

const ForumPost = () => {
  const { postId } = useParams();
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data: post } = useQuery({
    queryKey: ['forum-post', postId],
    queryFn: async () => {
      const { data } = await supabase.from('forum_posts').select('*').eq('id', postId!).single();
      return data;
    },
    enabled: !!postId,
  });

  // Increment view
  useEffect(() => {
    if (postId) {
      supabase.from('forum_posts').update({ view_count: (post?.view_count || 0) + 1 }).eq('id', postId).then(() => {});
    }
  }, [postId]);

  const { data: author } = useQuery({
    queryKey: ['forum-post-author', post?.user_id],
    enabled: !!post?.user_id,
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('id, full_name, avatar_url').eq('id', post!.user_id).single();
      return data;
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['forum-comments', postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data } = await supabase.from('forum_comments').select('id, post_id, user_id, parent_id, content, created_at').eq('post_id', postId!).order('created_at').limit(200);
      return data || [];
    },
  });

  const commentUserIds = [...new Set(comments.map((c: any) => c.user_id))];
  const { data: commentProfiles = [] } = useQuery({
    queryKey: ['forum-comment-profiles', commentUserIds.join(',')],
    enabled: commentUserIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('id, full_name, avatar_url').in('id', commentUserIds);
      return data || [];
    },
  });
  const profMap: Record<string, any> = {};
  commentProfiles.forEach((p: any) => { profMap[p.id] = p; });

  const { data: allReactions = [] } = useQuery({
    queryKey: ['forum-post-reactions', postId],
    enabled: !!postId,
    queryFn: async () => {
      const ids = [postId!, ...comments.map((c: any) => c.id)];
      const { data } = await supabase.from('forum_reactions').select('id, target_id, target_type, user_id, emoji').in('target_id', ids).limit(2000);
      return data || [];
    },
  });

  const { data: category } = useQuery({
    queryKey: ['forum-category', post?.category_id],
    enabled: !!post?.category_id,
    queryFn: async () => {
      const { data } = await supabase.from('forum_categories').select('name').eq('id', post!.category_id).single();
      return data;
    },
  });

  // Leaderboard for rank badges
  const { data: leaderboard = [] } = useQuery({
    queryKey: ['forum-leaderboard'],
    queryFn: async () => {
      const { data: points } = await supabase.from('forum_contributor_points').select('user_id, points');
      const map: Record<string, number> = {};
      (points || []).forEach((p: any) => { map[p.user_id] = (map[p.user_id] || 0) + p.points; });
      return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([uid], idx) => ({ user_id: uid, rank: idx + 1 }));
    },
  });

  const getRankBadge = (userId: string) => {
    const e = leaderboard.find((l: any) => l.user_id === userId);
    if (!e) return null;
    if (e.rank === 1) return <span className="text-amber-500">🥇</span>;
    if (e.rank === 2) return <span className="text-gray-400">🥈</span>;
    if (e.rank === 3) return <span className="text-orange-600">🥉</span>;
    return null;
  };

  const getReactions = (targetId: string, targetType: string) => {
    const filtered = allReactions.filter((r: any) => r.target_id === targetId && r.target_type === targetType);
    const grouped: Record<string, { count: number; myReaction: boolean }> = {};
    filtered.forEach((r: any) => {
      if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, myReaction: false };
      grouped[r.emoji].count++;
      if (r.user_id === user?.id) grouped[r.emoji].myReaction = true;
    });
    return grouped;
  };

  const toggleReaction = async (targetId: string, targetType: string, emoji: string) => {
    if (!user) return toast.error('Please login to react');
    const existing = allReactions.find((r: any) => r.target_id === targetId && r.target_type === targetType && r.emoji === emoji && r.user_id === user.id);
    if (existing) {
      await supabase.from('forum_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('forum_reactions').insert({ user_id: user.id, target_type: targetType, target_id: targetId, emoji });
      await supabase.from('forum_contributor_points').insert({ user_id: user.id, action: 'react', reference_id: targetId, points: 1 });
    }
    qc.invalidateQueries({ queryKey: ['forum-post-reactions'] });
    qc.invalidateQueries({ queryKey: ['forum-leaderboard'] });
  };

  const addComment = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: string }) => {
      const { data, error } = await supabase.from('forum_comments').insert({
        post_id: postId!, user_id: user!.id, content, parent_id: parentId || null,
      }).select().single();
      if (error) throw error;
      await supabase.from('forum_contributor_points').insert({ user_id: user!.id, action: 'reply', reference_id: data.id, points: 5 });
      return data;
    },
    onSuccess: () => {
      toast.success('Comment added');
      setComment('');
      setReplyTo(null);
      setReplyText('');
      qc.invalidateQueries({ queryKey: ['forum-comments'] });
      qc.invalidateQueries({ queryKey: ['forum-leaderboard'] });
    },
  });

  const toggleClose = async () => {
    await supabase.from('forum_posts').update({ is_closed: !post?.is_closed }).eq('id', postId!);
    qc.invalidateQueries({ queryKey: ['forum-post'] });
    toast.success(post?.is_closed ? 'Forum reopened' : 'Forum closed');
  };

  const togglePin = async () => {
    await supabase.from('forum_posts').update({ is_pinned: !post?.is_pinned }).eq('id', postId!);
    qc.invalidateQueries({ queryKey: ['forum-post'] });
    toast.success(post?.is_pinned ? 'Unpinned' : 'Pinned');
  };

  const deletePost = async () => {
    if (!confirm('Delete this post?')) return;
    await supabase.from('forum_posts').delete().eq('id', postId!);
    toast.success('Post deleted');
    navigate('/forum');
  };

  const deleteComment = async (id: string) => {
    await supabase.from('forum_comments').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['forum-comments'] });
    toast.success('Comment removed');
  };

  const topComments = comments.filter((c: any) => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter((c: any) => c.parent_id === parentId);

  if (!post) return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;

  const ReactionBar = ({ targetId, targetType }: { targetId: string; targetType: string }) => {
    const grouped = getReactions(targetId, targetType);
    return (
      <div className="flex items-center gap-1 flex-wrap mt-2">
        {EMOJIS.map(emoji => {
          const d = grouped[emoji];
          return (
            <button
              key={emoji}
              onClick={() => toggleReaction(targetId, targetType, emoji)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${d?.myReaction ? 'bg-primary/10 border-primary' : 'border-border hover:bg-muted'}`}
            >
              {emoji} {d?.count || 0}
            </button>
          );
        })}
      </div>
    );
  };

  const CommentCard = ({ c, depth = 0 }: { c: any; depth?: number }) => {
    const prof = profMap[c.user_id];
    const replies = getReplies(c.id);
    return (
      <div className={`${depth > 0 ? 'ml-6 border-l-2 border-muted pl-4' : ''} mt-3`}>
        <div className="flex items-start gap-2">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={prof?.avatar_url} />
            <AvatarFallback className="text-[10px]">{prof?.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium flex items-center gap-1">{prof?.full_name || 'User'} {getRankBadge(c.user_id)}</span>
              <span className="text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
            </div>
            <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.content}</p>
            <ReactionBar targetId={c.id} targetType="comment" />
            <div className="flex items-center gap-2 mt-1">
              {user && !post?.is_closed && (
                <button onClick={() => setReplyTo(c.id)} className="text-xs text-primary hover:underline">Reply</button>
              )}
              {(user?.id === c.user_id || isAdmin) && (
                <button onClick={() => deleteComment(c.id)} className="text-xs text-destructive hover:underline">Delete</button>
              )}
            </div>
            {replyTo === c.id && (
              <div className="flex gap-2 mt-2">
                <Textarea placeholder="Write a reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} className="text-sm min-h-[60px]" />
                <div className="flex flex-col gap-1">
                  <Button size="sm" disabled={!replyText.trim()} onClick={() => addComment.mutate({ content: replyText, parentId: c.id })}><Send className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReplyText(''); }}>×</Button>
                </div>
              </div>
            )}
          </div>
        </div>
        {replies.map((r: any) => <CommentCard key={r.id} c={r} depth={depth + 1} />)}
      </div>
    );
  };

  return (
    <>
      <SEOHead title={`${post.title} - Forum`} description={post.content?.slice(0, 160)} />
      <Header />
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl py-8 space-y-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/forum')} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Forum
          </Button>

          {/* Post */}
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={author?.avatar_url} />
                <AvatarFallback>{author?.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {post.is_pinned && <Pin className="h-4 w-4 text-primary" />}
                  {post.is_closed && <Lock className="h-4 w-4 text-muted-foreground" />}
                  <h1 className="text-xl font-heading font-bold">{post.title}</h1>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <span className="font-medium text-foreground flex items-center gap-1">{author?.full_name || 'Unknown'} {getRankBadge(post.user_id)}</span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                  {category && (
                    <>
                      <span>·</span>
                      <Badge variant="secondary" className="text-[10px]">{category.name}</Badge>
                    </>
                  )}
                  <span>·</span>
                  <span>{post.view_count} views</span>
                </div>
                <div className="mt-4 prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">{post.content}</div>
                <ReactionBar targetId={post.id} targetType="post" />

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  {user?.id === post.user_id && (
                    <Button variant="outline" size="sm" onClick={toggleClose}>
                      <Lock className="h-3.5 w-3.5 mr-1" /> {post.is_closed ? 'Reopen' : 'Close Forum'}
                    </Button>
                  )}
                  {isAdmin && (
                    <>
                      <Button variant="outline" size="sm" onClick={togglePin}>
                        <Pin className="h-3.5 w-3.5 mr-1" /> {post.is_pinned ? 'Unpin' : 'Pin'}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={deletePost}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Comments */}
          <div>
            <h2 className="font-heading font-semibold text-lg flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5" /> {comments.length} Comments
            </h2>

            {/* Add comment */}
            {user && !post.is_closed ? (
              <Card className="p-4 mb-4">
                <Textarea placeholder="Write a comment..." value={comment} onChange={(e) => setComment(e.target.value)} className="min-h-[80px]" />
                <div className="flex justify-end mt-2">
                  <Button size="sm" disabled={!comment.trim() || addComment.isPending} onClick={() => addComment.mutate({ content: comment })}>
                    <Send className="h-3.5 w-3.5 mr-1" /> Comment
                  </Button>
                </div>
              </Card>
            ) : post.is_closed ? (
              <Card className="p-4 mb-4 text-center text-muted-foreground text-sm">🔒 This forum is closed. No new comments.</Card>
            ) : null}

            {topComments.map((c: any) => <CommentCard key={c.id} c={c} />)}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ForumPost;
