import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface VideoCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  cover_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ClassVideo {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  category_id: string | null;
  video_url: string;
  video_platform: 'upload' | 'drive' | 'youtube';
  clip_start_seconds: number;
  clip_end_seconds: number | null;
  duration_seconds: number | null;
  tags: string[];
  visibility: 'public' | 'logged_in' | 'paid';
  required_course_id: string | null;
  is_published: boolean;
  is_featured: boolean;
  views_count: number;
  likes_count: number;
  comments_count: number;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  video_categories?: VideoCategory | null;
}

export function useVideoCategories() {
  return useQuery({
    queryKey: ['video-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as VideoCategory[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useAllVideoCategories() {
  return useQuery({
    queryKey: ['video-categories', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as VideoCategory[];
    },
    staleTime: 60 * 1000,
  });
}

export function useClassVideos(opts?: {
  categorySlug?: string;
  featured?: boolean;
  search?: string;
  limit?: number;
  sort?: 'newest' | 'popular';
}) {
  return useQuery({
    queryKey: ['class-videos', opts],
    queryFn: async () => {
      let q = supabase
        .from('class_videos')
        .select('*, video_categories(*)')
        .eq('is_published', true);

      if (opts?.featured) q = q.eq('is_featured', true);
      if (opts?.search) {
        q = q.or(`title.ilike.%${opts.search}%,description.ilike.%${opts.search}%`);
      }

      if (opts?.sort === 'popular') {
        q = q.order('views_count', { ascending: false });
      } else {
        q = q.order('created_at', { ascending: false });
      }
      if (opts?.limit) q = q.limit(opts.limit);

      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as ClassVideo[];
      if (opts?.categorySlug) {
        rows = rows.filter((r) => r.video_categories?.slug === opts.categorySlug);
      }
      return rows;
    },
    staleTime: 60 * 1000,
  });
}

export function useClassVideo(slug: string | undefined) {
  return useQuery({
    queryKey: ['class-video', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_videos')
        .select('*, video_categories(*)')
        .eq('slug', slug as string)
        .maybeSingle();
      if (error) throw error;
      return data as ClassVideo | null;
    },
  });
}

export function useRelatedVideos(video: ClassVideo | null | undefined) {
  return useQuery({
    queryKey: ['class-videos', 'related', video?.id],
    enabled: !!video,
    queryFn: async () => {
      if (!video) return [];
      const { data, error } = await supabase
        .from('class_videos')
        .select('*, video_categories(*)')
        .eq('is_published', true)
        .eq('category_id', video.category_id ?? '')
        .neq('id', video.id)
        .order('views_count', { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as ClassVideo[];
    },
  });
}

function getOrCreateSessionKey(): string {
  try {
    const KEY = 'cv_session_key';
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) + '-' + Date.now().toString(36);
      localStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2);
  }
}

export function useTrackVideoView() {
  return useMutation({
    mutationFn: async (videoId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase
          .from('class_video_views')
          .upsert(
            { video_id: videoId, user_id: user.id },
            { onConflict: 'video_id,user_id', ignoreDuplicates: true }
          );
      } else {
        const session_key = getOrCreateSessionKey();
        await supabase
          .from('class_video_views')
          .upsert(
            { video_id: videoId, user_id: null, session_key },
            { onConflict: 'video_id,session_key', ignoreDuplicates: true }
          );
      }
    },
  });
}

export function useVideoLike(videoId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const liked = useQuery({
    queryKey: ['class-video-like', videoId, user?.id],
    enabled: !!videoId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('class_video_likes')
        .select('id')
        .eq('video_id', videoId as string)
        .eq('user_id', user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const toggle = useMutation({
    mutationFn: async (currentlyLiked: boolean) => {
      if (!user?.id || !videoId) throw new Error('Login required');
      if (currentlyLiked) {
        const { error } = await supabase
          .from('class_video_likes')
          .delete()
          .eq('video_id', videoId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('class_video_likes')
          .insert({ video_id: videoId, user_id: user.id });
        if (error) throw error;
      }
    },
    onMutate: async (currentlyLiked: boolean) => {
      // Optimistic flip of liked flag
      await qc.cancelQueries({ queryKey: ['class-video-like', videoId] });
      const prev = qc.getQueryData(['class-video-like', videoId, user?.id]);
      qc.setQueryData(['class-video-like', videoId, user?.id], !currentlyLiked);
      return { prev };
    },
    onError: (e: any, _vars, ctx) => {
      qc.setQueryData(['class-video-like', videoId, user?.id], ctx?.prev);
      toast({ title: 'Action failed', description: e.message, variant: 'destructive' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['class-video-like', videoId] });
      qc.invalidateQueries({ queryKey: ['class-video'] });
      qc.invalidateQueries({ queryKey: ['class-videos'] });
    },
  });

  return { isLiked: !!liked.data, toggle };
}

