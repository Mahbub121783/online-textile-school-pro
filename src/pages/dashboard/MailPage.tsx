import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import MailSidebar, { MailFolder } from '@/components/mail/MailSidebar';
import MessageList, { MailMessage } from '@/components/mail/MessageList';
import MessageView from '@/components/mail/MessageView';
import ComposeModal, { ComposeData } from '@/components/mail/ComposeModal';
import SignatureManager from '@/components/mail/SignatureManager';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Search, Trash2, MailOpen, RefreshCw, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const MailPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [folder, setFolder] = useState<MailFolder>('inbox');
  const [selectedMsg, setSelectedMsg] = useState<MailMessage | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState<Partial<ComposeData> | undefined>();
  const [searchQ, setSearchQ] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Get user's institutional email
  const { data: emailReq } = useQuery({
    queryKey: ['my-edumail', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('institutional_email_requests')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'approved')
        .limit(1);
      return (data?.[0] as any) || null;
    },
  });

  const userEmail = emailReq?.requested_email || '';

  // Fetch messages
  const { data: messages = [], isLoading, refetch } = useQuery({
    queryKey: ['edumail-messages', user?.id, folder, searchQ],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from('edumail_messages')
        .select('*')
        .eq('owner_id', user!.id)
        .eq('folder', folder)
        .order('created_at', { ascending: false })
        .limit(50);
      if (searchQ) {
        q = q.or(`subject.ilike.%${searchQ}%,body_text.ilike.%${searchQ}%,from_email.ilike.%${searchQ}%`);
      }
      const { data } = await q;
      return (data || []) as MailMessage[];
    },
  });

  // Unread / draft counts
  const { data: counts } = useQuery({
    queryKey: ['edumail-counts', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ count: unread }, { count: drafts }] = await Promise.all([
        supabase.from('edumail_messages').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).eq('folder', 'inbox').eq('is_read', false),
        supabase.from('edumail_messages').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).eq('folder', 'drafts'),
      ]);
      return { unread: unread || 0, drafts: drafts || 0 };
    },
  });

  const syncInbox = useCallback(async (showToast = false, reset = false) => {
    if (!user || emailReq?.status !== 'approved') return;

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('edumail-imap-sync', reset ? { body: { reset: true } } : undefined);

      if (error) {
        let message = 'Inbox sync failed';
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) message = body.error;
        } catch (_) {}
        if (error.message && error.message !== 'Edge Function returned a non-2xx status code') {
          message = error.message;
        }
        throw new Error(message);
      }

      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['edumail-counts'] }),
      ]);

      if (showToast) {
        toast.success(
          reset
            ? `Inbox repaired. ${data?.new_messages || 0} message(s) re-imported.`
            : data?.new_messages > 0
            ? `${data.new_messages} new message(s) received.`
            : 'Inbox is up to date.'
        );
      }
    } catch (err: any) {
      toast.error(err.message || 'Inbox sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [emailReq?.status, queryClient, refetch, user]);

  useEffect(() => {
    if (folder === 'inbox' && emailReq?.status === 'approved') {
      void syncInbox(false);
    }
  }, [emailReq?.id, emailReq?.status, folder, syncInbox]);

  // Send via edge function
  const sendMessage = async (data: ComposeData) => {
    const { error } = await supabase.functions.invoke('edumail-client', {
      body: { action: 'send-message', ...data },
    });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['edumail-messages'] });
    queryClient.invalidateQueries({ queryKey: ['edumail-counts'] });
    toast.success('Message sent!');
  };

  const saveDraft = async (data: ComposeData) => {
    const { error } = await supabase.from('edumail_messages').insert({
      owner_id: user!.id,
      folder: 'drafts',
      from_email: userEmail,
      to_emails: data.to.split(',').map(e => e.trim()).filter(Boolean),
      cc_emails: data.cc ? data.cc.split(',').map(e => e.trim()).filter(Boolean) : [],
      bcc_emails: data.bcc ? data.bcc.split(',').map(e => e.trim()).filter(Boolean) : [],
      subject: data.subject,
      body_html: data.body_html,
      body_text: data.body_html.replace(/<[^>]*>/g, ''),
      has_attachments: data.attachments.length > 0,
      attachments: data.attachments,
      signature_used: data.signature_id,
    });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['edumail-messages'] });
    queryClient.invalidateQueries({ queryKey: ['edumail-counts'] });
  };

  const markRead = async (msg: MailMessage) => {
    if (!msg.is_read) {
      await supabase.from('edumail_messages').update({ is_read: true }).eq('id', msg.id);
      queryClient.invalidateQueries({ queryKey: ['edumail-messages'] });
      queryClient.invalidateQueries({ queryKey: ['edumail-counts'] });
    }
    setSelectedMsg({ ...msg, is_read: true });
  };

  const toggleStar = async (id: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;
    await supabase.from('edumail_messages').update({ is_starred: !msg.is_starred }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['edumail-messages'] });
  };

  const moveToTrash = async (id: string) => {
    await supabase.from('edumail_messages').update({ folder: 'trash' }).eq('id', id);
    setSelectedMsg(null);
    queryClient.invalidateQueries({ queryKey: ['edumail-messages'] });
    queryClient.invalidateQueries({ queryKey: ['edumail-counts'] });
    toast.success('Moved to trash');
  };

  const recallMessage = async (id: string) => {
    await supabase.from('edumail_messages').update({ recalled_at: new Date().toISOString() }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['edumail-messages'] });
    toast.success('Message recalled');
    setSelectedMsg(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await supabase.from('edumail_messages').update({ folder: 'trash' }).eq('id', id);
    }
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['edumail-messages'] });
    toast.success(`${selectedIds.size} message(s) moved to trash`);
  };

  const openReply = (msg: MailMessage) => {
    setComposeData({
      to: msg.from_email,
      subject: msg.subject?.startsWith('Re: ') ? msg.subject : `Re: ${msg.subject}`,
      body_html: `<br/><br/><blockquote style="border-left:2px solid #ccc;padding-left:8px;margin-left:0">${msg.body_html}</blockquote>`,
    });
    setComposeOpen(true);
  };

  const openForward = (msg: MailMessage) => {
    setComposeData({
      subject: msg.subject?.startsWith('Fwd: ') ? msg.subject : `Fwd: ${msg.subject}`,
      body_html: `<br/><br/>---------- Forwarded message ----------<br/>From: ${msg.from_email}<br/>Subject: ${msg.subject}<br/><br/>${msg.body_html}`,
      attachments: msg.attachments as any || [],
    });
    setComposeOpen(true);
  };

  if (!emailReq) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <p className="text-muted-foreground">You need an active institutional email to use Mail.</p>
        <Button onClick={() => navigate('/dashboard/edumail')}>Setup EduMail</Button>
      </div>
    );
  }

  const canRecall = (msg: MailMessage) => {
    if (msg.folder !== 'sent' || msg.recalled_at) return false;
    if (!msg.sent_at) return false;
    const sentTime = new Date(msg.sent_at).getTime();
    return Date.now() - sentTime < 5 * 60 * 1000; // 5 min window
  };

  if (showSettings) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setShowSettings(false)}>← Back to Mail</Button>
        <SignatureManager />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-140px)] min-h-[500px]">
      {/* Sidebar */}
      <div className="w-48 shrink-0 hidden md:block">
        <MailSidebar
          activeFolder={folder}
          onFolderChange={f => { setFolder(f); setSelectedMsg(null); }}
          onCompose={() => { setComposeData(undefined); setComposeOpen(true); }}
          unreadCount={counts?.unread}
          draftCount={counts?.drafts}
          onOpenSettings={() => setShowSettings(true)}
        />
      </div>

      {/* Message list + view */}
      <Card className="flex-1 flex overflow-hidden">
        <div className={`w-full md:w-80 border-r flex flex-col shrink-0 ${selectedMsg ? 'hidden md:flex' : ''}`}>
          {/* Search + bulk actions */}
          <div className="p-2 border-b space-y-1">
            <div className="flex gap-1">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="h-8 pl-7 text-xs" placeholder="Search mail..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void syncInbox(true)} disabled={isSyncing} title="Refresh">
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (confirm('This will wipe your inbox and re-import all messages with the latest parser. Continue?')) {
                    void syncInbox(true, true);
                  }
                }}
                disabled={isSyncing}
                title="Repair inbox (reset & re-sync)"
              >
                <Wrench className="h-3.5 w-3.5" />
              </Button>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-6 text-xs" onClick={bulkDelete}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete ({selectedIds.size})
                </Button>
              </div>
            )}
          </div>
          {/* Mobile folder tabs */}
          <div className="flex md:hidden border-b overflow-x-auto">
            {(['inbox','sent','drafts','starred','trash'] as MailFolder[]).map(f => (
              <button key={f} onClick={() => { setFolder(f); setSelectedMsg(null); }}
                className={`px-3 py-2 text-xs whitespace-nowrap ${folder === f ? 'border-b-2 border-primary text-primary font-medium' : 'text-muted-foreground'}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="p-4"><TableSkeleton rows={5} columns={3} /></div>
            ) : (
              <MessageList
                messages={messages}
                selectedId={selectedMsg?.id}
                onSelect={markRead}
                onToggleStar={toggleStar}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                folder={folder}
              />
            )}
          </div>
        </div>

        {/* Message view */}
        <div className={`flex-1 ${!selectedMsg ? 'hidden md:flex items-center justify-center text-muted-foreground text-sm' : 'flex flex-col'}`}>
          {selectedMsg ? (
            <MessageView
              message={selectedMsg}
              onReply={() => openReply(selectedMsg)}
              onForward={() => openForward(selectedMsg)}
              onDelete={() => moveToTrash(selectedMsg.id)}
              onToggleStar={() => toggleStar(selectedMsg.id)}
              onRecall={canRecall(selectedMsg) ? () => recallMessage(selectedMsg.id) : undefined}
              canRecall={canRecall(selectedMsg)}
              onBack={() => setSelectedMsg(null)}
            />
          ) : (
            <span>Select a message to read</span>
          )}
        </div>
      </Card>

      {/* Compose Modal */}
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSend={sendMessage}
        onSaveDraft={saveDraft}
        initialData={composeData}
        userEmail={userEmail}
      />
    </div>
  );
};

export default MailPage;
