import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface VideoComment {
  id: string;
  video_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  likes_count: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  author?: { id: string; full_name: string | null; avatar_url: string | null } | null;
  replies?: VideoComment[];
}

export function useVideoComments(videoId: string | undefined) {
  return useQuery({
    queryKey: ['video-comments', videoId],
    enabled: !!videoId,
    queryFn: async () => {
      const { data: comments, error } = await supabase
        .from('class_video_comments')
        .select('id, video_id, user_id, parent_id, content, likes_count, is_deleted, created_at, updated_at')
        .eq('video_id', videoId as string)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const userIds = Array.from(new Set((comments ?? []).map((c: any) => c.user_id)));
      let profiles: any[] = [];
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('user_profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);
        profiles = profs ?? [];
      }
      const profMap = new Map(profiles.map((p) => [p.id, p]));

      const all: VideoComment[] = (comments ?? []).map((c: any) => ({
        ...c,
        author: profMap.get(c.user_id) ?? null,
        replies: [],
      }));

      // Build threaded
      const byId = new Map(all.map((c) => [c.id, c]));
      const top: VideoComment[] = [];
      for (const c of all) {
        if (c.parent_id && byId.has(c.parent_id)) {
          byId.get(c.parent_id)!.replies!.push(c);
        } else {
          top.push(c);
        }
      }
      // Replies sorted oldest first
      top.forEach((t) => t.replies!.sort((a, b) => a.created_at.localeCompare(b.created_at)));
      return top;
    },
  });
}

export function usePostComment(videoId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: string | null }) => {
      if (!user?.id) throw new Error('Login required to comment');
      if (!videoId) throw new Error('Missing video');
      if (!content.trim()) throw new Error('Comment cannot be empty');
      const { error } = await supabase.from('class_video_comments').insert({
        video_id: videoId,
        user_id: user.id,
        parent_id: parentId ?? null,
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['video-comments', videoId] });
      qc.invalidateQueries({ queryKey: ['class-video'] });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteComment(videoId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('class_video_comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['video-comments', videoId] }),
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });
}

export function useCommentLike(commentId: string, videoId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const liked = useQuery({
    queryKey: ['comment-like', commentId, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('class_video_comment_likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const toggle = useMutation({
    mutationFn: async (currentlyLiked: boolean) => {
      if (!user?.id) throw new Error('Login required');
      if (currentlyLiked) {
        const { error } = await supabase
          .from('class_video_comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('class_video_comment_likes')
          .insert({ comment_id: commentId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comment-like', commentId] });
      qc.invalidateQueries({ queryKey: ['video-comments', videoId] });
    },
  });

  return { isLiked: !!liked.data, toggle };
}
