import { MailMessage } from './MessageList';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Reply, Forward, Trash2, Archive, Star, Paperclip, Download, Undo2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

interface MessageViewProps {
  message: MailMessage;
  onReply: () => void;
  onForward: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
  onRecall?: () => void;
  canRecall?: boolean;
  onBack: () => void;
}

export default function MessageView({ message, onReply, onForward, onDelete, onToggleStar, onRecall, canRecall, onBack }: MessageViewProps) {
  const dateStr = message.sent_at || message.created_at
    ? format(new Date(message.sent_at || message.created_at), 'PPpp')
    : '';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b">
        <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{message.subject || '(no subject)'}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{message.from_email}</span>
            <span>→</span>
            <span className="truncate">{message.to_emails?.join(', ')}</span>
          </div>
          {message.cc_emails && message.cc_emails.length > 0 && (
            <p className="text-xs text-muted-foreground">CC: {message.cc_emails.join(', ')}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleStar}>
            <Star className={`h-4 w-4 ${message.is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Recalled banner */}
      {message.recalled_at && (
        <div className="bg-destructive/10 border-b px-4 py-2 text-sm text-destructive font-medium">
          ⚠️ This message was recalled on {format(new Date(message.recalled_at), 'PPpp')}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">
        {(() => {
          // Safety net: strip leftover IMAP trailers / MIME boundary lines from older bad rows
          const sanitize = (s: string) =>
            (s || '')
              .split(/\r?\n/)
              .filter((l) => !/^A\d{4}\s+(OK|NO|BAD)\b/.test(l))
              .filter((l) => !/^--[0-9a-zA-Z'()+_,\-./:=?]{10,}--?\s*$/.test(l))
              .filter((l) => !/^Content-(Type|Transfer-Encoding|Disposition):/i.test(l))
              .join('\n')
              .trim();

          const html = sanitize(message.body_html || '');
          const text = sanitize(message.body_text || '');
          if (html) {
            return <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: html }} />;
          }
          return <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{text || '(empty message)'}</pre>;
        })()}
      </div>

      {/* Attachments */}
      {message.has_attachments && message.attachments && (message.attachments as any[]).length > 0 && (
        <div className="border-t px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Paperclip className="h-3 w-3" /> Attachments</p>
          <div className="flex flex-wrap gap-2">
            {(message.attachments as any[]).map((att: any, i: number) => (
              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs hover:bg-muted/80">
                <Download className="h-3 w-3" />
                {att.name || `Attachment ${i + 1}`}
                {att.size && <span className="text-muted-foreground">({(att.size / 1024).toFixed(0)}KB)</span>}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="border-t p-3 flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={onReply}><Reply className="h-3.5 w-3.5 mr-1" /> Reply</Button>
        <Button size="sm" variant="outline" onClick={onForward}><Forward className="h-3.5 w-3.5 mr-1" /> Forward</Button>
        <Button size="sm" variant="outline" onClick={onDelete} className="text-destructive"><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
        {canRecall && onRecall && (
          <Button size="sm" variant="outline" onClick={onRecall} className="text-amber-600"><Undo2 className="h-3.5 w-3.5 mr-1" /> Recall</Button>
        )}
      </div>
    </div>
  );
}
