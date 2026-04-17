import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type ContributorRole = 'lead_instructor' | 'co_instructor' | 'author' | 'co_author' | 'reviewer';
export type ContentType = 'course' | 'ebook' | 'workshop';

export interface ContributorRow {
  id: string;
  user_id: string;
  role: ContributorRole;
  sort_order: number;
  user_profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    headline: string | null;
  } | null;
}

export const useContributors = (contentType: ContentType, contentId?: string | null) =>
  useQuery({
    queryKey: ['content-contributors', contentType, contentId],
    enabled: !!contentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_contributors')
        .select('id, user_id, role, sort_order, user_profiles!content_contributors_user_id_fkey(id, full_name, avatar_url, headline)')
        .eq('content_type', contentType)
        .eq('content_id', contentId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ContributorRow[];
    },
  });

export const useAddContributor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { contentType: ContentType; contentId: string; userId: string; role: ContributorRole; sortOrder?: number }) => {
      const { error } = await supabase.from('content_contributors').insert({
        content_type: input.contentType,
        content_id: input.contentId,
        user_id: input.userId,
        role: input.role,
        sort_order: input.sortOrder ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['content-contributors', v.contentType, v.contentId] });
      toast.success('Contributor added');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to add'),
  });
};

export const useRemoveContributor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; contentType: ContentType; contentId: string }) => {
      const { error } = await supabase.from('content_contributors').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['content-contributors', v.contentType, v.contentId] });
      toast.success('Contributor removed');
    },
  });
};

export const useContributorVote = (contributorId?: string) => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const myVote = useQuery({
    queryKey: ['contributor-vote', contributorId, user?.id],
    enabled: !!contributorId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('contributor_votes')
        .select('id')
        .eq('contributor_id', contributorId!)
        .eq('voter_id', user!.id)
        .maybeSingle();
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user || !contributorId) throw new Error('not-authenticated');
      if (myVote.data) {
        const { error } = await supabase.from('contributor_votes').delete().eq('id', myVote.data.id);
        if (error) throw error;
        return 'removed' as const;
      }
      const { error } = await supabase.from('contributor_votes').insert({
        contributor_id: contributorId,
        voter_id: user.id,
      });
      if (error) throw error;
      return 'added' as const;
    },
    onSuccess: (kind) => {
      qc.invalidateQueries({ queryKey: ['contributor-vote', contributorId] });
      qc.invalidateQueries({ queryKey: ['contributor-profile', contributorId] });
      toast.success(kind === 'added' ? '👍 Endorsed!' : 'Endorsement removed');
    },
    onError: (e: any) => toast.error(e.message || 'Action failed'),
  });

  return { myVote: myVote.data, hasVoted: !!myVote.data, toggle };
};
