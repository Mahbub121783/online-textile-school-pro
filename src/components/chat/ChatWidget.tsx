import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  MessageCircle, X, Send, ArrowLeft, UserPlus, Check, XIcon,
  Ban, Trash2, Inbox, MessageSquare, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];

const ChatWidget = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('chats');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [reactingMsgId, setReactingMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);

  // ── Presence & Typing Channel ──
  useEffect(() => {
    if (!user?.id || !open) return;
    const channel = supabase.channel(`presence-chat-${Date.now()}`, { config: { presence: { key: user.id } } });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnlineUsers(new Set(Object.keys(state)));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== user.id) {
          setTypingUsers(prev => new Set(prev).add(payload.userId));
          setTimeout(() => {
            setTypingUsers(prev => { const n = new Set(prev); n.delete(payload.userId); return n; });
          }, 3000);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    presenceChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, open]);

  // ── Real-time message listener ──
  useEffect(() => {
    if (!user?.id || !open) return;
    const ch = supabase.channel(`chat-rt-${user.id}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `receiver_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ['chat-messages'] });
        qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_requests', filter: `receiver_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ['chat-requests'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, open]);

  // ── Accepted contacts (conversations) ──
  const { data: conversations = [] } = useQuery({
    queryKey: ['chat-conversations', user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      // Get accepted requests
      const { data: requests } = await supabase
        .from('chat_requests')
        .select('*')
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .eq('status', 'accepted');

      if (!requests?.length) return [];

      const contactIds = requests.map((r: any) => r.sender_id === user!.id ? r.receiver_id : r.sender_id);

      // Get last message per contact
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('sender_id, receiver_id, message, created_at, is_read, deleted_at')
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order('created_at', { ascending: false });

      const userMap = new Map<string, { lastMessage: string; lastTime: string; unread: number }>();
      (messages ?? []).forEach((m: any) => {
        const otherId = m.sender_id === user!.id ? m.receiver_id : m.sender_id;
        if (!contactIds.includes(otherId)) return;
        if (!userMap.has(otherId)) {
          userMap.set(otherId, {
            lastMessage: m.deleted_at ? '🚫 Message deleted' : m.message,
            lastTime: m.created_at,
            unread: 0,
          });
        }
        if (m.receiver_id === user!.id && !m.is_read && !m.deleted_at) {
          const e = userMap.get(otherId)!;
          e.unread++;
        }
      });

      // Add contacts with no messages yet
      contactIds.forEach(id => {
        if (!userMap.has(id)) userMap.set(id, { lastMessage: 'No messages yet', lastTime: new Date().toISOString(), unread: 0 });
      });

      const ids = Array.from(userMap.keys());
      if (!ids.length) return [];

      const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, avatar_url').in('id', ids);

      return ids.map(id => {
        const p = (profiles ?? []).find((pr: any) => pr.id === id);
        return { userId: id, name: p?.full_name || 'User', avatar: p?.avatar_url, ...userMap.get(id)! };
      }).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
    },
    refetchInterval: open ? 5000 : false,
  });

  // ── Chat requests ──
  const { data: chatRequests = { incoming: [], outgoing: [] } } = useQuery({
    queryKey: ['chat-requests', user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from('chat_requests')
        .select('*')
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .eq('status', 'pending');

      const incoming: any[] = [];
      const outgoing: any[] = [];
      const userIds = new Set<string>();

      (data ?? []).forEach((r: any) => {
        if (r.receiver_id === user!.id) { incoming.push(r); userIds.add(r.sender_id); }
        else { outgoing.push(r); userIds.add(r.receiver_id); }
      });

      if (userIds.size > 0) {
        const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, avatar_url').in('id', Array.from(userIds));
        const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
        incoming.forEach(r => { const p = pMap.get(r.sender_id); r.profile = p; });
        outgoing.forEach(r => { const p = pMap.get(r.receiver_id); r.profile = p; });
      }

      return { incoming, outgoing };
    },
    refetchInterval: open ? 5000 : false,
  });

  // ── Blocked users ──
  const { data: blockedIds = [] } = useQuery({
    queryKey: ['chat-blocked', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('chat_requests')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .eq('status', 'blocked');
      return (data ?? []).map((r: any) => r.sender_id === user!.id ? r.receiver_id : r.sender_id);
    },
  });

  // ── Messages ──
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

  // ── Search users ──
  const { data: searchResults = [] } = useQuery({
    queryKey: ['chat-search-users', search],
    enabled: search.length >= 2 && !selectedUser,
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('id, full_name, avatar_url').ilike('full_name', `%${search}%`).neq('id', user!.id).limit(10);
      return (data ?? []).filter((u: any) => !blockedIds.includes(u.id));
    },
  });

  // ── Mark read ──
  useEffect(() => {
    if (selectedUser && user?.id && chatMessages.length > 0) {
      const unreadIds = chatMessages.filter((m: any) => m.receiver_id === user.id && !m.is_read).map((m: any) => m.id);
      if (unreadIds.length > 0) {
        supabase.from('chat_messages').update({ is_read: true } as any).in('id', unreadIds).then(() => {
          qc.invalidateQueries({ queryKey: ['chat-conversations'] });
        });
      }
    }
  }, [chatMessages, selectedUser, user?.id]);

  // ── Auto scroll ──
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // ── Send message ──
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!message.trim() || !selectedUser) return;
      await supabase.from('chat_messages').insert({ sender_id: user!.id, receiver_id: selectedUser.userId, message: message.trim() } as any);
    },
    onSuccess: () => {
      setMessage('');
      qc.invalidateQueries({ queryKey: ['chat-messages'] });
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });

  // ── Send request ──
  const sendRequest = useMutation({
    mutationFn: async (receiverId: string) => {
      // Check if request already exists in either direction
      const { data: existing } = await supabase
        .from('chat_requests')
        .select('id, status')
        .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user!.id})`)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'accepted') {
          setSelectedUser({ userId: receiverId });
          return;
        }
        return; // already pending
      }

      await supabase.from('chat_requests').insert({ sender_id: user!.id, receiver_id: receiverId } as any);
    },
    onSuccess: () => {
      setSearch('');
      qc.invalidateQueries({ queryKey: ['chat-requests'] });
    },
  });

  // ── Accept/Decline/Block request ──
  const updateRequest = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from('chat_requests').update({ status, updated_at: new Date().toISOString() } as any).eq('id', id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-requests'] });
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      qc.invalidateQueries({ queryKey: ['chat-blocked'] });
    },
  });

  // ── Block from chat header ──
  const blockUser = useMutation({
    mutationFn: async (otherUserId: string) => {
      const { data: existing } = await supabase
        .from('chat_requests')
        .select('id')
        .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user!.id})`)
        .maybeSingle();

      if (existing) {
        await supabase.from('chat_requests').update({ status: 'blocked', updated_at: new Date().toISOString() } as any).eq('id', existing.id);
      } else {
        await supabase.from('chat_requests').insert({ sender_id: user!.id, receiver_id: otherUserId, status: 'blocked' } as any);
      }
    },
    onSuccess: () => {
      setSelectedUser(null);
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      qc.invalidateQueries({ queryKey: ['chat-blocked'] });
    },
  });

  // ── Soft delete message ──
  const deleteMessage = useMutation({
    mutationFn: async (msgId: string) => {
      await supabase.from('chat_messages').update({ deleted_at: new Date().toISOString() } as any).eq('id', msgId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-messages'] }),
  });

  // ── React to message ──
  const reactToMessage = useMutation({
    mutationFn: async ({ msgId, emoji }: { msgId: string; emoji: string }) => {
      const msg = chatMessages.find((m: any) => m.id === msgId);
      const reactions = (msg as any)?.reactions || {};
      const key = emoji;
      if (reactions[key]?.includes(user!.id)) {
        reactions[key] = reactions[key].filter((id: string) => id !== user!.id);
        if (reactions[key].length === 0) delete reactions[key];
      } else {
        reactions[key] = [...(reactions[key] || []), user!.id];
      }
      await supabase.from('chat_messages').update({ reactions } as any).eq('id', msgId);
    },
    onSuccess: () => {
      setReactingMsgId(null);
      qc.invalidateQueries({ queryKey: ['chat-messages'] });
    },
  });

  // ── Typing broadcast ──
  const broadcastTyping = useCallback(() => {
    if (presenceChannelRef.current && selectedUser) {
      presenceChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: user?.id, to: selectedUser.userId } });
    }
  }, [selectedUser, user?.id]);

  const handleTyping = (val: string) => {
    setMessage(val);
    broadcastTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {}, 3000);
  };

  // Check if a search result is already a contact
  const getContactStatus = (userId: string): 'accepted' | 'pending' | 'none' => {
    if (conversations.some((c: any) => c.userId === userId)) return 'accepted';
    if (chatRequests.incoming.some((r: any) => r.sender_id === userId) || chatRequests.outgoing.some((r: any) => r.receiver_id === userId)) return 'pending';
    return 'none';
  };

  const totalUnread = conversations.reduce((sum: number, c: any) => sum + (c.unread || 0), 0);
  const pendingCount = chatRequests.incoming.length;

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 lg:bottom-6 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && (totalUnread + pendingCount) > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
            {totalUnread + pendingCount}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-36 lg:bottom-24 right-4 z-[9999] w-80 sm:w-96 h-[30rem] bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {selectedUser ? (
            <>
              {/* Chat header */}
              <div className="px-3 py-2.5 border-b bg-primary/5 flex items-center gap-2">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setSelectedUser(null); setReactingMsgId(null); }}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedUser.avatar} />
                    <AvatarFallback>{selectedUser.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {onlineUsers.has(selectedUser.userId) && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{selectedUser.name}</p>
                  {typingUsers.has(selectedUser.userId) ? (
                    <p className="text-[10px] text-green-600 animate-pulse">typing...</p>
                  ) : onlineUsers.has(selectedUser.userId) ? (
                    <p className="text-[10px] text-green-600">Online</p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">Offline</p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => { if (confirm('Block this user?')) blockUser.mutate(selectedUser.userId); }}
                >
                  <Ban className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                  {chatMessages.map((msg: any) => {
                    const isMine = msg.sender_id === user.id;
                    const isDeleted = !!msg.deleted_at;
                    const reactions = msg.reactions || {};

                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
                        <div className="relative max-w-[75%]">
                          <div
                            className={`px-3 py-2 rounded-2xl text-sm ${
                              isDeleted
                                ? 'bg-muted text-muted-foreground italic'
                                : isMine
                                  ? 'bg-primary text-primary-foreground rounded-br-md'
                                  : 'bg-secondary rounded-bl-md'
                            }`}
                            onDoubleClick={() => !isDeleted && setReactingMsgId(reactingMsgId === msg.id ? null : msg.id)}
                          >
                            <p>{isDeleted ? '🚫 This message was deleted' : msg.message}</p>
                            <p className={`text-[10px] mt-0.5 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                            </p>
                          </div>

                          {/* Reactions display */}
                          {Object.keys(reactions).length > 0 && (
                            <div className="flex gap-0.5 mt-0.5 flex-wrap">
                              {Object.entries(reactions).map(([emoji, users]: [string, any]) => (
                                <button
                                  key={emoji}
                                  onClick={() => reactToMessage.mutate({ msgId: msg.id, emoji })}
                                  className={`text-xs px-1 py-0.5 rounded-full border ${
                                    users.includes(user.id) ? 'bg-primary/10 border-primary/30' : 'bg-muted border-border'
                                  }`}
                                >
                                  {emoji} {users.length}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Reaction picker */}
                          {reactingMsgId === msg.id && !isDeleted && (
                            <div className={`absolute ${isMine ? 'right-0' : 'left-0'} -top-8 bg-background border rounded-full shadow-lg px-1 py-0.5 flex gap-0.5 z-10`}>
                              {REACTIONS.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => reactToMessage.mutate({ msgId: msg.id, emoji })}
                                  className="hover:scale-125 transition-transform text-sm px-1"
                                >
                                  {emoji}
                                </button>
                              ))}
                              {isMine && (
                                <button
                                  onClick={() => { deleteMessage.mutate(msg.id); setReactingMsgId(null); }}
                                  className="hover:scale-125 transition-transform text-sm px-1 text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage.mutate(); }}
                className="p-2.5 border-t flex gap-2"
              >
                <Input
                  value={message}
                  onChange={(e) => handleTyping(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 h-9 text-sm"
                  autoFocus
                />
                <Button type="submit" size="icon" className="h-9 w-9" disabled={!message.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-2.5 border-b bg-primary/5 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <span className="font-heading font-bold text-sm">Messages</span>
              </div>

              {/* Search */}
              <div className="p-2 border-b">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users to connect..."
                  className="h-8 text-sm"
                />
              </div>

              {/* Search results overlay */}
              {search.length >= 2 && searchResults.length > 0 ? (
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    <p className="text-xs text-muted-foreground px-2 mb-1 font-medium">Send a message request</p>
                    {searchResults.map((u: any) => {
                      const status = getContactStatus(u.id);
                      return (
                        <div key={u.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary transition-colors">
                          <div className="relative">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={u.avatar_url} />
                              <AvatarFallback>{u.full_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            {onlineUsers.has(u.id) && (
                              <span className="absolute bottom-0 right-0 h-2 w-2 bg-green-500 rounded-full border border-background" />
                            )}
                          </div>
                          <span className="text-sm font-medium truncate flex-1">{u.full_name}</span>
                          {status === 'accepted' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => { setSelectedUser({ userId: u.id, name: u.full_name, avatar: u.avatar_url }); setSearch(''); }}
                            >
                              <MessageSquare className="h-3 w-3 mr-1" /> Chat
                            </Button>
                          ) : status === 'pending' ? (
                            <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => sendRequest.mutate(u.id)}
                              disabled={sendRequest.isPending}
                            >
                              <UserPlus className="h-3 w-3 mr-1" /> Request
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="mx-2 mt-1 h-8">
                    <TabsTrigger value="chats" className="text-xs flex-1 gap-1 h-7">
                      <MessageSquare className="h-3 w-3" /> Chats
                      {totalUnread > 0 && <Badge variant="destructive" className="h-4 px-1 text-[9px]">{totalUnread}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="requests" className="text-xs flex-1 gap-1 h-7">
                      <Inbox className="h-3 w-3" /> Requests
                      {pendingCount > 0 && <Badge variant="destructive" className="h-4 px-1 text-[9px]">{pendingCount}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="sent" className="text-xs flex-1 gap-1 h-7">
                      <Clock className="h-3 w-3" /> Sent
                    </TabsTrigger>
                  </TabsList>

                  {/* Conversations */}
                  <TabsContent value="chats" className="flex-1 overflow-hidden mt-0">
                    <ScrollArea className="h-full">
                      <div className="p-2">
                        {conversations.length === 0 ? (
                          <p className="text-center text-sm text-muted-foreground py-8">No conversations yet. Search for users to connect!</p>
                        ) : (
                          conversations.map((conv: any) => (
                            <button
                              key={conv.userId}
                              onClick={() => setSelectedUser(conv)}
                              className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary transition-colors"
                            >
                              <div className="relative">
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={conv.avatar} />
                                  <AvatarFallback>{conv.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                {onlineUsers.has(conv.userId) && (
                                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-background" />
                                )}
                                {conv.unread > 0 && (
                                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center">
                                    {conv.unread}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-semibold truncate">{conv.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                              </div>
                              <span className="text-[9px] text-muted-foreground shrink-0">
                                {formatDistanceToNow(new Date(conv.lastTime), { addSuffix: true })}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Incoming requests */}
                  <TabsContent value="requests" className="flex-1 overflow-hidden mt-0">
                    <ScrollArea className="h-full">
                      <div className="p-2">
                        {chatRequests.incoming.length === 0 ? (
                          <p className="text-center text-sm text-muted-foreground py-8">No pending requests</p>
                        ) : (
                          chatRequests.incoming.map((req: any) => (
                            <div key={req.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary transition-colors">
                              <div className="relative">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={req.profile?.avatar_url} />
                                  <AvatarFallback>{req.profile?.full_name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                {onlineUsers.has(req.sender_id) && (
                                  <span className="absolute bottom-0 right-0 h-2 w-2 bg-green-500 rounded-full border border-background" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{req.profile?.full_name || 'User'}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="icon"
                                  variant="default"
                                  className="h-7 w-7"
                                  onClick={() => updateRequest.mutate({ id: req.id, status: 'accepted' })}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-7 w-7"
                                  onClick={() => updateRequest.mutate({ id: req.id, status: 'declined' })}
                                >
                                  <XIcon className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => updateRequest.mutate({ id: req.id, status: 'blocked' })}
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Sent requests */}
                  <TabsContent value="sent" className="flex-1 overflow-hidden mt-0">
                    <ScrollArea className="h-full">
                      <div className="p-2">
                        {chatRequests.outgoing.length === 0 ? (
                          <p className="text-center text-sm text-muted-foreground py-8">No sent requests</p>
                        ) : (
                          chatRequests.outgoing.map((req: any) => (
                            <div key={req.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary transition-colors">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={req.profile?.avatar_url} />
                                <AvatarFallback>{req.profile?.full_name?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{req.profile?.full_name || 'User'}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                                </p>
                              </div>
                              <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
};

export default ChatWidget;
