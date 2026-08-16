import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Repeat, User, X } from 'lucide-react';

interface OwnershipTransferCardProps {
  campus: { id: string; pending_owner_id: string | null };
}

/**
 * Lets the current campus owner hand ownership to another OTS user.
 * Two-step: look up the target by email (campus-transfer-lookup, since
 * user_profiles has no email column), then request the transfer -- which
 * only sets a *pending* owner. An admin has to approve
 * (campus-transfer-approve) before submitted_by actually changes; RLS
 * itself blocks a non-admin owner from reassigning submitted_by directly.
 */
const OwnershipTransferCard = ({ campus }: OwnershipTransferCardProps) => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<{ id: string; full_name: string; avatar_url: string | null } | null>(null);

  const lookupMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('campus-transfer-lookup', { body: { campus_id: campus.id, email: email.trim() } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => setFound(data),
    onError: (e: any) => { toast.error(e.message); setFound(null); },
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('campus_onboard_requests').update({
        pending_owner_id: found!.id,
        ownership_transfer_status: 'pending',
        ownership_transfer_requested_at: new Date().toISOString(),
      }).eq('id', campus.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-owned-campus-full'] });
      toast.success('Transfer requested — awaiting admin approval');
      setFound(null); setEmail('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('campus_onboard_requests').update({
        pending_owner_id: null, ownership_transfer_status: null, ownership_transfer_requested_at: null,
      }).eq('id', campus.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-owned-campus-full'] });
      toast.success('Transfer request cancelled');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Repeat className="h-4 w-4" /> Transfer Ownership</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {campus.pending_owner_id ? (
          <div className="border rounded-lg p-3 bg-muted/20 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Transfer requested — awaiting admin approval.</p>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive shrink-0" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Hand ownership of this campus portfolio to another Online Textile School account. The transfer needs admin approval before it takes effect.</p>
            <div className="flex gap-2">
              <Input type="email" placeholder="New owner's email" value={email} onChange={(e) => { setEmail(e.target.value); setFound(null); }} />
              <Button variant="outline" onClick={() => lookupMutation.mutate()} disabled={lookupMutation.isPending || !email.trim()}>
                {lookupMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Look Up
              </Button>
            </div>
            {found && (
              <div className="border rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
                    {found.avatar_url ? <img src={found.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <p className="text-sm font-medium truncate">{found.full_name}</p>
                </div>
                <Button size="sm" onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending}>
                  {requestMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  Request Transfer
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default OwnershipTransferCard;
