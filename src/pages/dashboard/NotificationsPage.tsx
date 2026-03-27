import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, BookOpen, GraduationCap, FileText, ClipboardList, MessageSquare, Award, Megaphone, Info, CheckCheck, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

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

const typeLabels: Record<string, string> = {
  course_published: 'Course',
  lesson_locked: 'Lesson',
  result_published: 'Result',
  result_recalculated: 'Gradebook',
  material_uploaded: 'Material',
  qa_answered: 'Q&A',
  assignment_graded: 'Assignment',
  quiz_graded: 'Quiz',
  enrollment: 'Enrollment',
  announcement: 'Announcement',
  system: 'System',
};

const NotificationsPage = () => {
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? notifications : filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications.filter(n => n.type === filter);

  const handleClick = (notif: any) => {
    if (!notif.is_read) markAsRead(notif.id);
    if (notif.link) navigate(notif.link);
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from('notifications' as any).delete().eq('user_id', user.id);
    queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllRead()}>
              <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAll}>
              <Trash2 className="h-4 w-4 mr-1" /> Clear all
            </Button>
          )}
        </div>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
          <TabsTrigger value="course_published">Courses</TabsTrigger>
          <TabsTrigger value="result_published">Results</TabsTrigger>
          <TabsTrigger value="announcement">Announcements</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No notifications to show</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map(notif => {
            const Icon = typeIcons[notif.type] || Info;
            return (
              <Card
                key={notif.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${!notif.is_read ? 'border-primary/30 bg-primary/5' : ''}`}
                onClick={() => handleClick(notif)}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div className={`rounded-full p-2.5 shrink-0 ${!notif.is_read ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${!notif.is_read ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full shrink-0">
                        {typeLabels[notif.type] || notif.type}
                      </span>
                      {!notif.is_read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
