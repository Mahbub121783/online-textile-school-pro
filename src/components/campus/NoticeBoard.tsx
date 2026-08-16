import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Megaphone, Loader2, Trash2, EyeOff, Eye, Plus } from 'lucide-react';

interface NoticeBoardProps {
  campusId: string;
  /** 'manage' = full CRUD (campus owner or admin). 'public' = read-only, active notices only. */
  mode: 'manage' | 'public';
}

/**
 * Campus notice board -- new feature, no prior table. Same manage/public
 * split as the gallery: campus owner and admin can both post/toggle/delete
 * (RLS in db/53 grants both), everyone else just sees active notices.
 */
const NoticeBoard = ({ campusId, mode }: NoticeBoardProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['campus-notices', campusId, mode],
    enabled: !!campusId,
    // Push (useCampusRealtime) invalidates this instantly on a real change;
    // this interval is only the fallback for clients where SSE didn't
    // connect (blocked by a proxy, EventSource unsupported, etc).
    refetchInterval: 45000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      let query = supabase.from('campus_notices').select('*').eq('campus_id', campusId).order('created_at', { ascending: false });
      if (mode === 'public') query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('campus_notices').insert({
        campus_id: campusId, title: title.trim(), body: body.trim(), posted_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campus-notices', campusId] });
      toast.success('Notice posted');
      setTitle(''); setBody(''); setAdding(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('campus_notices').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campus-notices', campusId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campus_notices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campus-notices', campusId] });
      toast.success('Notice removed');
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (mode === 'public' && !isLoading && notices.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold flex items-center gap-2"><Megaphone className="h-4 w-4" /> Notice Board</h3>
        {mode === 'manage' && (
          <Button type="button" size="sm" variant="outline" onClick={() => setAdding((a) => !a)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Notice
          </Button>
        )}
      </div>

      {mode === 'manage' && adding && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
          <Input placeholder="Notice title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Notice details..." rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button
              type="button" size="sm"
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !title.trim() || !body.trim()}
            >
              {addMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Post Notice
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
      ) : notices.length === 0 ? (
        mode === 'manage' && <p className="text-xs text-muted-foreground">No notices posted yet.</p>
      ) : (
        <div className="space-y-2">
          {notices.map((n: any) => (
            <div key={n.id} className={`border rounded-lg p-3 ${n.is_active ? 'bg-card' : 'bg-muted/30 opacity-70'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
                    {n.title}
                    {mode === 'manage' && !n.is_active && <Badge variant="outline" className="text-[10px]">Hidden</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{n.body}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">{format(new Date(n.created_at), 'dd MMM yyyy')}</p>
                </div>
                {mode === 'manage' && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      type="button" size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => toggleMutation.mutate({ id: n.id, is_active: !n.is_active })}
                      disabled={toggleMutation.isPending}
                      title={n.is_active ? 'Hide from public' : 'Show to public'}
                    >
                      {n.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm('Delete this notice?')) deleteMutation.mutate(n.id); }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NoticeBoard;
