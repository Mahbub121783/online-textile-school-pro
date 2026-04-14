import { Star, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';

export interface MailMessage {
  id: string;
  folder: string;
  from_email: string;
  to_emails: string[];
  cc_emails?: string[];
  subject: string;
  body_html: string;
  body_text: string;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  attachments?: any[];
  created_at: string;
  sent_at?: string;
  recalled_at?: string;
  thread_id?: string;
  in_reply_to?: string;
}

interface MessageListProps {
  messages: MailMessage[];
  selectedId?: string;
  onSelect: (msg: MailMessage) => void;
  onToggleStar: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  folder: string;
}

export default function MessageList({ messages, selectedId, onSelect, onToggleStar, selectedIds, onToggleSelect, folder }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">No messages in {folder}</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {messages.map(msg => {
        const displayDate = msg.sent_at || msg.created_at;
        const dateStr = displayDate ? format(new Date(displayDate), 'MMM d') : '';
        const isSelected = selectedId === msg.id;

        return (
          <div
            key={msg.id}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors',
              isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/50',
              !msg.is_read && 'font-medium'
            )}
            onClick={() => onSelect(msg)}
          >
            <Checkbox
              checked={selectedIds.has(msg.id)}
              onCheckedChange={() => onToggleSelect(msg.id)}
              onClick={e => e.stopPropagation()}
              className="shrink-0"
            />
            <button
              className="shrink-0"
              onClick={e => { e.stopPropagation(); onToggleStar(msg.id); }}
            >
              <Star className={cn('h-4 w-4', msg.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40')} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn('text-sm truncate', !msg.is_read && 'font-semibold')}>
                  {folder === 'sent' || folder === 'drafts' ? `To: ${msg.to_emails?.[0] || '(no recipient)'}` : msg.from_email}
                </span>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">{dateStr}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs truncate text-muted-foreground">{msg.subject || '(no subject)'}</span>
                {msg.has_attachments && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
