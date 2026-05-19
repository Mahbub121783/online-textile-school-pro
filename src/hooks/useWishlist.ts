import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const useWishlist = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: wishlistIds = new Set<string>() } = useQuery({
    queryKey: ['wishlist-ids', user?.id],
    enabled: !!user,
    retry: 0,
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from('wishlists')
          .select('course_id')
          .eq('user_id', user!.id);
        return new Set((data ?? []).map((w) => w.course_id).filter(Boolean) as string[]);
      } catch {
        return new Set<string>();
      }
    },
  });

  const toggleWishlist = useMutation({
    mutationFn: async (courseId: string) => {
      if (!user) throw new Error('Login required');
      const isWished = wishlistIds.has(courseId);
      if (isWished) {
        await supabase.from('wishlists').delete().eq('user_id', user.id).eq('course_id', courseId);
      } else {
        await supabase.from('wishlists').insert({ user_id: user.id, course_id: courseId });
      }
      return !isWished;
    },
    onMutate: async (courseId) => {
      await queryClient.cancelQueries({ queryKey: ['wishlist-ids', user?.id] });
      const prev = queryClient.getQueryData<Set<string>>(['wishlist-ids', user?.id]);
      queryClient.setQueryData(['wishlist-ids', user?.id], () => {
        const next = new Set(prev);
        if (next.has(courseId)) next.delete(courseId);
        else next.add(courseId);
        return next;
      });
      return { prev };
    },
    onError: (_err, _courseId, context) => {
      queryClient.setQueryData(['wishlist-ids', user?.id], context?.prev);
      toast.error('Failed to update wishlist');
    },
    onSuccess: (added) => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast.success(added ? 'Added to wishlist' : 'Removed from wishlist');
    },
  });

  return { wishlistIds, toggleWishlist: toggleWishlist.mutate, isToggling: toggleWishlist.isPending };
};
