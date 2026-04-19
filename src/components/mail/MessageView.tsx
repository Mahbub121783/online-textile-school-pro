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
          // Strip MIME / IMAP leftovers from legacy bad rows
          const sanitize = (s: string) =>
            (s || '')
              .split(/\r?\n/)
              .filter((l) => !/^A\d{4}\s+(OK|NO|BAD)\b/i.test(l))
              .filter((l) => !/^--[0-9a-zA-Z'()+_,\-./:=?]{8,}--?\s*$/.test(l))
              .filter((l) => !/^Content-(Type|Transfer-Encoding|Disposition|ID|Description):/i.test(l))
              .filter((l) => !/^MIME-Version:/i.test(l))
              .filter((l) => !/^(boundary|charset|format|delsp|name|filename)=/i.test(l.trim()))
              .filter((l) => !/^\)\s*$/.test(l))
              .filter((l) => !/^\s*\)\s*A\d{4}\s/i.test(l))
              .join('\n')
              .replace(/\n{3,}/g, '\n\n')
              .trim();

          // Detect "fake HTML" — body_html that is actually raw MIME text
          const looksLikeRawMime = (s: string) =>
            /Content-Type:\s*multipart/i.test(s) ||
            /Content-Transfer-Encoding:/i.test(s) ||
            /^--[0-9a-zA-Z]{16,}/m.test(s) ||
            /\bA\d{4}\s+OK\s+Fetch\s+completed/i.test(s);

          // Detect real HTML (must have actual HTML tags, not just plain text)
          const hasRealHtml = (s: string) =>
            /<\s*(html|body|div|p|br|span|a|table|h[1-6]|ul|ol|li|img|strong|em|b|i)\b/i.test(s);

          const rawHtml = message.body_html || '';
          const rawText = message.body_text || '';

          if (rawHtml && hasRealHtml(rawHtml) && !looksLikeRawMime(rawHtml)) {
            return (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: sanitize(rawHtml) }}
              />
            );
          }

          // Fallback: render as cleaned plain text
          const cleanText = sanitize(rawText) || sanitize(rawHtml.replace(/<[^>]+>/g, ''));
          return (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {cleanText || '(empty message)'}
            </pre>
          );
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
