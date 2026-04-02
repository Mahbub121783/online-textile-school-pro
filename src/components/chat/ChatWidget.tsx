import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle, X, Send, Search, ArrowLeft, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

const ChatWidget = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get conversations (unique users chatted with)
  const { data: conversations = [] } = useQuery({
    queryKey: ['chat-conversations', user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('sender_id, receiver_id, message, created_at, is_read')
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order('created_at', { ascending: false });

      if (!messages?.length) return [];

      const userMap = new Map<string, { lastMessage: string; lastTime: string; unread: number }>();
      messages.forEach((m: any) => {
        const otherId = m.sender_id === user!.id ? m.receiver_id : m.sender_id;
        if (!userMap.has(otherId)) {
          userMap.set(otherId, { lastMessage: m.message, lastTime: m.created_at, unread: 0 });
        }
        if (m.receiver_id === user!.id && !m.is_read) {
          const entry = userMap.get(otherId)!;
          entry.unread++;
        }
      });

      const userIds = Array.from(userMap.keys());
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, avatar_url').in('id', userIds);

      return userIds.map(id => {
        const profile = (profiles ?? []).find((p: any) => p.id === id);
        const info = userMap.get(id)!;
        return { userId: id, name: profile?.full_name || 'User', avatar: profile?.avatar_url, ...info };
      });
    },
    refetchInterval: open ? 5000 : false,
  });

  // Get messages for selected conversation
  const { data: chatMessages = [] } = useQuery({
    queryKey: ['chat-messages', user?.id, selectedUser?.userId],
    enabled: !!user?.id && !!selectedUser,
    queryFn: async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${selectedUser.userId}),and(sender_id.eq.${selectedUser.userId},receiver_id.eq.${user!.id})`)
        .order('created_at', { ascending: true });
      return data ?? [];
    },
    refetchInterval: selectedUser ? 3000 : false,
  });

  // Search users to start new conversation
  const { data: searchResults = [] } = useQuery({
    queryKey: ['chat-search-users', search],
    enabled: search.length >= 2 && !selectedUser,
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('id, full_name, avatar_url').ilike('full_name', `%${search}%`).neq('id', user!.id).limit(10);
      return data ?? [];
    },
  });

  // Mark messages as read
  useEffect(() => {
    if (selectedUser && user?.id && chatMessages.length > 0) {
      const unreadIds = chatMessages.filter((m: any) => m.receiver_id === user.id && !m.is_read).map((m: any) => m.id);
      if (unreadIds.length > 0) {
        supabase.from('chat_messages').update({ is_read: true }).in('id', unreadIds).then(() => {
          queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
        });
      }
    }
  }, [chatMessages, selectedUser, user?.id]);

  // Auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id || !open) return;
    const channel = supabase.channel(`chat-${user.id}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `receiver_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, open]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!message.trim() || !selectedUser) return;
      await supabase.from('chat_messages').insert({ sender_id: user!.id, receiver_id: selectedUser.userId, message: message.trim() });
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });

  const totalUnread = conversations.reduce((sum: number, c: any) => sum + (c.unread || 0), 0);

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 lg:bottom-6 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">{totalUnread}</span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-36 lg:bottom-22 right-4 z-50 w-80 sm:w-96 h-[28rem] bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b bg-primary/5 flex items-center gap-3">
            {selectedUser ? (
              <>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedUser(null)}><ArrowLeft className="h-4 w-4" /></Button>
                <Avatar className="h-8 w-8"><AvatarImage src={selectedUser.avatar} /><AvatarFallback>{selectedUser.name?.charAt(0)}</AvatarFallback></Avatar>
                <span className="font-semibold text-sm truncate">{selectedUser.name}</span>
              </>
            ) : (
              <>
                <MessageCircle className="h-5 w-5 text-primary" />
                <span className="font-heading font-bold">Messages</span>
              </>
            )}
          </div>

          {selectedUser ? (
            <>
              {/* Messages */}
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                  {chatMessages.map((msg: any) => {
                    const isMine = msg.sender_id === user.id;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${isMine ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-secondary rounded-bl-md'}`}>
                          <p>{msg.message}</p>
                          <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <form onSubmit={(e) => { e.preventDefault(); sendMessage.mutate(); }} className="p-3 border-t flex gap-2">
                <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..." className="flex-1 h-9 text-sm" autoFocus />
                <Button type="submit" size="icon" className="h-9 w-9" disabled={!message.trim()}><Send className="h-4 w-4" /></Button>
              </form>
            </>
          ) : (
            <>
              {/* Search */}
              <div className="p-3 border-b">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="h-9 text-sm" />
              </div>

              <ScrollArea className="flex-1">
                {/* Search results */}
                {search.length >= 2 && searchResults.length > 0 && (
                  <div className="p-2 border-b">
                    <p className="text-xs text-muted-foreground px-2 mb-1">Start a conversation</p>
                    {searchResults.map((u: any) => (
                      <button key={u.id} onClick={() => { setSelectedUser({ userId: u.id, name: u.full_name, avatar: u.avatar_url }); setSearch(''); }} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors">
                        <Avatar className="h-8 w-8"><AvatarImage src={u.avatar_url} /><AvatarFallback>{u.full_name?.charAt(0)}</AvatarFallback></Avatar>
                        <span className="text-sm font-medium truncate">{u.full_name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Conversations */}
                <div className="p-2">
                  {conversations.length === 0 && !search ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No conversations yet. Search for a user to start chatting!</p>
                  ) : (
                    conversations.map((conv: any) => (
                      <button key={conv.userId} onClick={() => setSelectedUser(conv)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors">
                        <div className="relative">
                          <Avatar className="h-10 w-10"><AvatarImage src={conv.avatar} /><AvatarFallback>{conv.name?.charAt(0)}</AvatarFallback></Avatar>
                          {conv.unread > 0 && <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">{conv.unread}</span>}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-semibold truncate">{conv.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatDistanceToNow(new Date(conv.lastTime), { addSuffix: true })}</span>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default ChatWidget;
