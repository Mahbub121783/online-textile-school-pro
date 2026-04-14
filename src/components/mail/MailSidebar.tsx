import { Inbox, Send, FileEdit, Trash2, Star, PenSquare, Settings, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type MailFolder = 'inbox' | 'sent' | 'drafts' | 'trash' | 'starred';

interface MailSidebarProps {
  activeFolder: MailFolder;
  onFolderChange: (folder: MailFolder) => void;
  onCompose: () => void;
  unreadCount?: number;
  draftCount?: number;
  onOpenSettings?: () => void;
}

const folders: { key: MailFolder; label: string; icon: any }[] = [
  { key: 'inbox', label: 'Inbox', icon: Inbox },
  { key: 'sent', label: 'Sent', icon: Send },
  { key: 'drafts', label: 'Drafts', icon: FileEdit },
  { key: 'starred', label: 'Starred', icon: Star },
  { key: 'trash', label: 'Trash', icon: Trash2 },
];

export default function MailSidebar({ activeFolder, onFolderChange, onCompose, unreadCount = 0, draftCount = 0, onOpenSettings }: MailSidebarProps) {
  const getBadge = (key: MailFolder) => {
    if (key === 'inbox' && unreadCount > 0) return unreadCount;
    if (key === 'drafts' && draftCount > 0) return draftCount;
    return 0;
  };

  return (
    <div className="w-full space-y-2">
      <Button onClick={onCompose} className="w-full gap-2">
        <PenSquare className="h-4 w-4" /> Compose
      </Button>
      <div className="space-y-0.5 mt-3">
        {folders.map(f => {
          const badge = getBadge(f.key);
          return (
            <button
              key={f.key}
              onClick={() => onFolderChange(f.key)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                activeFolder === f.key ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'
              )}
            >
              <f.icon className="h-4 w-4" />
              <span className="flex-1 text-left">{f.label}</span>
              {badge > 0 && <Badge variant="destructive" className="h-5 min-w-5 text-[10px] px-1.5 justify-center">{badge}</Badge>}
            </button>
          );
        })}
      </div>
      {onOpenSettings && (
        <button onClick={onOpenSettings} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted mt-4">
          <Settings className="h-4 w-4" /> Account Settings
        </button>
      )}
    </div>
  );
}
