import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  MessageCircle, X, Send, ArrowLeft, UserPlus, Check, XIcon,
  Ban, Trash2, Inbox, MessageSquare, Clock, Bot, Loader2, Sparkles, LogIn
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];

const AI_TUTOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`;

type AiMsg = { role: 'user' | 'assistant'; content: string };

// ─── AI Tutor Tab Content ───
const AI_SESSION_KEY = 'ots_ai_chat';
const AI_SESSION_TS_KEY = 'ots_ai_chat_ts';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function loadCachedMessages(): AiMsg[] {
  try {
    const ts = localStorage.getItem(AI_SESSION_TS_KEY);
    if (ts && Date.now() - Number(ts) > THREE_DAYS_MS) {
      localStorage.removeItem(AI_SESSION_KEY);
      localStorage.removeItem(AI_SESSION_TS_KEY);
      return [];
    }
    const raw = localStorage.getItem(AI_SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

const AiTutorTab = ({ user }: { user: any }) => {
  const [messages, setMessages] = useState<AiMsg[]>(loadCachedMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(AI_SESSION_KEY, JSON.stringify(messages));
      if (!localStorage.getItem(AI_SESSION_TS_KEY)) {
        localStorage.setItem(AI_SESSION_TS_KEY, String(Date.now()));
      }
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: AiMsg = { role: 'user', content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput('');
    setLoading(true);

    let assistantSoFar = '';

    try {
      const resp = await fetch(AI_TUTOR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          user_id: user?.id || 'guest',
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'AI service error' }));
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${err.error || 'Something went wrong.'}` }]);
        setLoading(false);
        return;
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch { /* partial JSON */ }
        }
      }
    } catch (e) {
      console.error('AI Tutor error:', e);
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Connection error. Please try again.' }]);
    }
    setLoading(false);
  };

  const quickPrompts = [
    "What is GSM in textiles?",
    "Explain ring spinning",
    "Calculate yarn count",
    "Dyeing process steps",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-emerald-500 to-teal-600 text-white shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <span className="font-heading font-semibold text-xs block leading-tight">AI Tutor</span>
            <span className="text-[10px] text-emerald-100">Textile Engineering Expert</span>
          </div>
        </div>
        <button onClick={() => { setMessages([]); localStorage.removeItem(AI_SESSION_KEY); localStorage.removeItem(AI_SESSION_TS_KEY); }} className="p-1 hover:bg-white/20 rounded-lg transition" title="Clear chat">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-4 px-3">
            <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center">
              <Bot className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="font-heading font-semibold text-foreground mb-1 text-xs">Hi! I'm your AI Tutor 🎓</p>
            <p className="text-[11px] mb-3">Ask me about textile engineering, courses, or calculations!</p>
            <div className="space-y-1.5">
              {quickPrompts.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="block w-full text-left text-[11px] px-2.5 py-1.5 rounded-lg border hover:bg-muted transition"
                >
                  💡 {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-1.5`}>
            {msg.role === 'assistant' && (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 mt-1">
                <Bot className="h-3 w-3 text-white" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted rounded-bl-md'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0 [&>ul]:my-1 [&>ol]:my-1 [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mt-2 text-xs">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-xs">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
              <Bot className="h-3 w-3 text-white" />
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t shrink-0">
        <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about textiles..."
            className="text-xs rounded-xl h-8"
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()} className="rounded-xl shrink-0 h-8 w-8">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
};

// ─── Login Prompt ───
const LoginPrompt = ({ label }: { label: string }) => {
  const navigate = useNavigate();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <LogIn className="h-10 w-10 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">Log in to access {label}</p>
      <Button size="sm" onClick={() => navigate('/auth/login')}>
        Log in
      </Button>
    </div>
  );
};

// ─── Main ChatWidget ───
const ChatWidget = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ai');
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
      const { data: requests } = await supabase
        .from('chat_requests')
        .select('*')
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .eq('status', 'accepted');

      if (!requests?.length) return [];

      const contactIds = requests.map((r: any) => r.sender_id === user!.id ? r.receiver_id : r.sender_id);

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
    enabled: search.length >= 2 && !selectedUser && !!user?.id,
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
      // Notify receiver
      import('@/lib/notifications').then(({ createNotification, NOTIFICATION_TYPES }) => {
        createNotification({
          userId: selectedUser.userId,
          type: NOTIFICATION_TYPES.NEW_MESSAGE,
          title: '💬 New Message',
          message: `You have a new message: "${message.trim().slice(0, 50)}${message.trim().length > 50 ? '...' : ''}"`,
        });
      });
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
        return;
      }

      await supabase.from('chat_requests').insert({ sender_id: user!.id, receiver_id: receiverId } as any);
      // Notify receiver about friend request
      import('@/lib/notifications').then(({ createNotification, NOTIFICATION_TYPES }) => {
        createNotification({
          userId: receiverId,
          type: NOTIFICATION_TYPES.CHAT_REQUEST_RECEIVED,
          title: '👋 New Friend Request',
          message: 'Someone sent you a chat request. Check your messages!',
        });
      });
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
      // Notify the sender about acceptance/rejection
      const allReqs = [...(chatRequests?.incoming || []), ...(chatRequests?.outgoing || [])];
      const req = allReqs.find((r: any) => r.id === id);
      if (req) {
        const senderId = req.sender_id === user!.id ? req.receiver_id : req.sender_id;
        import('@/lib/notifications').then(({ createNotification, NOTIFICATION_TYPES }) => {
          if (status === 'accepted') {
            createNotification({ userId: senderId, type: NOTIFICATION_TYPES.CHAT_REQUEST_ACCEPTED, title: 'Friend Request Accepted ✅', message: 'Your chat request has been accepted! You can now start chatting.' });
          } else if (status === 'declined') {
            createNotification({ userId: senderId, type: NOTIFICATION_TYPES.CHAT_REQUEST_REJECTED, title: 'Friend Request Declined', message: 'Your chat request was declined.' });
          }
        });
      }
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
      const reactions = { ...((msg as any)?.reactions || {}) };
      if (reactions[emoji]?.includes(user!.id)) {
        reactions[emoji] = reactions[emoji].filter((id: string) => id !== user!.id);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...(reactions[emoji] || []), user!.id];
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

  const getContactStatus = (userId: string): 'accepted' | 'pending' | 'none' => {
    if (conversations.some((c: any) => c.userId === userId)) return 'accepted';
    if (chatRequests.incoming.some((r: any) => r.sender_id === userId) || chatRequests.outgoing.some((r: any) => r.receiver_id === userId)) return 'pending';
    return 'none';
  };

  const totalUnread = conversations.reduce((sum: number, c: any) => sum + (c.unread || 0), 0);
  const pendingCount = chatRequests.incoming.length;

  return (
    <>
      {/* Floating bubble — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-[9999] h-14 w-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg hover:shadow-2xl transition-all flex items-center justify-center"
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
        <div className="fixed bottom-24 right-6 z-[9999] w-80 sm:w-96 h-[30rem] bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
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
                    const isMine = msg.sender_id === user!.id;
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

                          {Object.keys(reactions).length > 0 && (
                            <div className="flex gap-0.5 mt-0.5 flex-wrap">
                              {Object.entries(reactions).map(([emoji, users]: [string, any]) => (
                                <button
                                  key={emoji}
                                  onClick={() => reactToMessage.mutate({ msgId: msg.id, emoji })}
                                  className={`text-xs px-1 py-0.5 rounded-full border ${
                                    users.includes(user!.id) ? 'bg-primary/10 border-primary/30' : 'bg-muted border-border'
                                  }`}
                                >
                                  {emoji} {users.length}
                                </button>
                              ))}
                            </div>
                          )}

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

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mx-2 mt-1 h-8 w-auto">
                  <TabsTrigger value="ai" className="text-[11px] flex-1 gap-1 h-7">
                    <Sparkles className="h-3 w-3" /> AI Tutor
                  </TabsTrigger>
                  <TabsTrigger value="chats" className="text-[11px] flex-1 gap-1 h-7">
                    <MessageSquare className="h-3 w-3" /> Chats
                    {totalUnread > 0 && <Badge variant="destructive" className="h-4 px-1 text-[9px]">{totalUnread}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="requests" className="text-[11px] flex-1 gap-1 h-7">
                    <Inbox className="h-3 w-3" /> Requests
                    {pendingCount > 0 && <Badge variant="destructive" className="h-4 px-1 text-[9px]">{pendingCount}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="sent" className="text-[11px] flex-1 gap-1 h-7">
                    <Clock className="h-3 w-3" /> Sent
                  </TabsTrigger>
                </TabsList>

                {/* AI Tutor — available to everyone */}
                <TabsContent value="ai" className="flex-1 overflow-hidden mt-0">
                  <AiTutorTab user={user} />
                </TabsContent>

                {/* Chats — requires login */}
                <TabsContent value="chats" className="flex-1 overflow-hidden mt-0">
                  {!user ? (
                    <LoginPrompt label="your messages" />
                  ) : (
                    <>
                      {/* Search */}
                      <div className="p-2 border-b">
                        <Input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search users to connect..."
                          className="h-8 text-sm"
                        />
                      </div>

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
                      )}
                    </>
                  )}
                </TabsContent>

                {/* Incoming requests */}
                <TabsContent value="requests" className="flex-1 overflow-hidden mt-0">
                  {!user ? (
                    <LoginPrompt label="message requests" />
                  ) : (
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
                  )}
                </TabsContent>

                {/* Sent requests */}
                <TabsContent value="sent" className="flex-1 overflow-hidden mt-0">
                  {!user ? (
                    <LoginPrompt label="sent requests" />
                  ) : (
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
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default ChatWidget;
