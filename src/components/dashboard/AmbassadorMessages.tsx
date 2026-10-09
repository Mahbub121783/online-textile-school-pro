import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  applicationId: string;
  // true when rendered on the admin side (sent messages are flagged as
  // from-admin); false when rendered on the ambassador's own Hub page.
  asAdmin: boolean;
}

const AmbassadorMessages = ({ applicationId, asAdmin }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['ambassador-messages', applicationId],
    enabled: !!applicationId,
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_messages')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!draft.trim() || !user) return;
      const { error } = await supabase.from('ambassador_messages').insert({
        application_id: applicationId,
        sender_id: user.id,
        sender_is_admin: asAdmin,
        message: draft.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['ambassador-messages', applicationId] });
    },
  });

  return (
    <div className="flex flex-col h-96 border rounded-lg overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/20">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No messages yet — say hello!</p>
        ) : (
          messages.map((m: any) => {
            const mine = m.sender_is_admin === asAdmin;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? 'bg-primary text-primary-foreground' : 'bg-card border'}`}>
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  <p className={`text-[10px] mt-1 ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {m.sender_is_admin ? 'Admin' : 'Ambassador'} · {format(new Date(m.created_at), 'dd MMM, h:mm a')}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 p-2 border-t bg-background">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMutation.mutate(); } }}
          placeholder="Type a message..."
          className="min-h-[40px] max-h-24 resize-none"
        />
        <Button size="icon" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending || !draft.trim()}>
          {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

export default AmbassadorMessages;
