import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, X, Send, Trash2, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

type Msg = { role: 'user' | 'assistant'; content: string };

const AI_TUTOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`;

const AiTutorWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  if (!user) return null;

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Msg = { role: 'user', content: text };
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
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'AI service error' }));
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${err.error || 'Something went wrong. Please try again.'}` }]);
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

  return (
    <>
      {/* Floating button - positioned above the existing chat widget */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-6 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
          title="AI Tutor"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[520px] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-500 to-indigo-600 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <span className="font-heading font-semibold text-sm">AI Tutor</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setMessages([]); }} className="p-1.5 hover:bg-white/20 rounded-lg transition" title="Clear chat">
                <Trash2 className="h-4 w-4" />
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8 px-4">
                <Bot className="h-10 w-10 mx-auto mb-3 text-violet-400" />
                <p className="font-medium mb-1">Hi! I'm your AI Tutor 🎓</p>
                <p className="text-xs">Ask me anything about your courses, assignments, or textile engineering concepts.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-violet-500 text-white rounded-br-md'
                    : 'bg-muted rounded-bl-md'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0 [&>ul]:my-1 [&>ol]:my-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t">
            <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask a question..."
                className="text-sm rounded-xl"
                disabled={loading}
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()} className="rounded-xl bg-violet-500 hover:bg-violet-600 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AiTutorWidget;
