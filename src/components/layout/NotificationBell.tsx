import { Bell, BookOpen, GraduationCap, FileText, ClipboardList, MessageSquare, Award, Megaphone, Info, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

const typeIcons: Record<string, React.ElementType> = {
  course_published: BookOpen,
  lesson_locked: FileText,
  result_published: GraduationCap,
  result_recalculated: GraduationCap,
  material_uploaded: FileText,
  qa_answered: MessageSquare,
  assignment_graded: ClipboardList,
  quiz_graded: Award,
  enrollment: BookOpen,
  announcement: Megaphone,
  system: Info,
};

interface NotificationBellProps {
  basePath?: string; // e.g. '/dashboard', '/admin', '/instructor'
}

const NotificationBell = ({ basePath = '/dashboard' }: NotificationBellProps) => {
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();
  const navigate = useNavigate();

  const handleClick = (notif: any) => {
    if (!notif.is_read) markAsRead(notif.id);
    if (notif.link) navigate(notif.link);
  };

  const latest = notifications.slice(0, 10);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] w-4.5 h-4.5 flex items-center justify-center rounded-full font-bold min-w-[18px] h-[18px] px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-heading font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markAllRead()}>
              <CheckCheck className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[340px]">
          {latest.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No notifications yet</div>
          ) : (
            latest.map(notif => {
              const Icon = typeIcons[notif.type] || Info;
              return (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-0 ${!notif.is_read ? 'bg-primary/5' : ''}`}
                >
                  <div className={`mt-0.5 rounded-full p-1.5 shrink-0 ${!notif.is_read ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight truncate ${!notif.is_read ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notif.is_read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                </button>
              );
            })
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="border-t px-4 py-2">
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate(`${basePath}/notifications`)}>
              View all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
