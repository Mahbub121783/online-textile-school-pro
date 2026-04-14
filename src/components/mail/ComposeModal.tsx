import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Send, Save, ChevronDown, X, Paperclip } from 'lucide-react';
import MailRichTextEditor from './MailRichTextEditor';
import { useFileUpload } from '@/hooks/useFileUpload';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  onSend: (data: ComposeData) => Promise<void>;
  onSaveDraft: (data: ComposeData) => Promise<void>;
  initialData?: Partial<ComposeData>;
  userEmail: string;
}

export interface ComposeData {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body_html: string;
  attachments: { name: string; url: string; size: number }[];
  signature_id?: string;
}

export default function ComposeModal({ open, onClose, onSend, onSaveDraft, initialData, userEmail }: ComposeModalProps) {
  const [to, setTo] = useState(initialData?.to || '');
  const [cc, setCc] = useState(initialData?.cc || '');
  const [bcc, setBcc] = useState(initialData?.bcc || '');
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [bodyHtml, setBodyHtml] = useState(initialData?.body_html || '');
  const [attachments, setAttachments] = useState<{ name: string; url: string; size: number }[]>(initialData?.attachments || []);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [signatureId, setSignatureId] = useState('');
  const fileUpload = useFileUpload();

  useEffect(() => {
    if (initialData) {
      setTo(initialData.to || '');
      setCc(initialData.cc || '');
      setBcc(initialData.bcc || '');
      setSubject(initialData.subject || '');
      setBodyHtml(initialData.body_html || '');
      setAttachments(initialData.attachments || []);
    }
  }, [initialData]);

  const { data: signatures } = useQuery({
    queryKey: ['edumail-signatures'],
    queryFn: async () => {
      const { data } = await supabase.from('edumail_signatures').select('*').order('is_default', { ascending: false });
      return data || [];
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ['edumail-contacts'],
    queryFn: async () => {
      const { data } = await supabase.from('edumail_contacts').select('*').order('display_name');
      return data || [];
    },
  });

  const handleAttach = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;
      for (const file of Array.from(files)) {
        try {
          const result = await fileUpload.upload(file);
          setAttachments(prev => [...prev, { name: file.name, url: result.url, size: file.size }]);
        } catch (err: any) {
          toast.error(`Failed to upload ${file.name}`);
        }
      }
    };
    input.click();
  };

  const getData = (): ComposeData => ({
    to, cc, bcc, subject, body_html: bodyHtml, attachments, signature_id: signatureId,
  });

  const handleSend = async () => {
    if (!to.trim()) { toast.error('Please enter a recipient'); return; }
    setSending(true);
    try {
      await onSend(getData());
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      await onSaveDraft(getData());
      toast.success('Draft saved');
      onClose();
    } catch (err: any) {
      toast.error('Failed to save draft');
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">New Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="w-12 text-right text-xs">From:</Label>
              <Input value={userEmail} disabled className="h-8 text-xs bg-muted" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="w-12 text-right text-xs">To:</Label>
              <Input value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com" className="h-8 text-xs" />
              {!showCcBcc && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowCcBcc(true)}>CC/BCC</Button>
              )}
            </div>
            {showCcBcc && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="w-12 text-right text-xs">CC:</Label>
                  <Input value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com" className="h-8 text-xs" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-12 text-right text-xs">BCC:</Label>
                  <Input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="bcc@example.com" className="h-8 text-xs" />
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <Label className="w-12 text-right text-xs">Subject:</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject" className="h-8 text-xs" />
            </div>
          </div>

          <MailRichTextEditor content={bodyHtml} onChange={setBodyHtml} placeholder="Write your message..." minHeight="250px" />

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((att, i) => (
                <Badge key={i} variant="secondary" className="text-xs gap-1">
                  <Paperclip className="h-3 w-3" /> {att.name}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} />
                </Badge>
              ))}
            </div>
          )}

          {/* Bottom bar */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button onClick={handleSend} disabled={sending}>
              <Send className="h-4 w-4 mr-1" /> {sending ? 'Sending...' : 'Send'}
            </Button>
            <Button variant="outline" onClick={handleAttach} disabled={fileUpload.uploading}>
              <Paperclip className="h-4 w-4 mr-1" /> Attach
            </Button>
            <Button variant="ghost" onClick={handleSaveDraft}>
              <Save className="h-4 w-4 mr-1" /> Save Draft
            </Button>
            {signatures && signatures.length > 0 && (
              <Select value={signatureId} onValueChange={v => {
                setSignatureId(v);
                const sig = signatures.find(s => s.id === v);
                if (sig) setBodyHtml(prev => prev + '<br/><br/>--<br/>' + sig.body_html);
              }}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="Add signature" />
                </SelectTrigger>
                <SelectContent>
                  {signatures.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
