import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquare, CheckCircle, Send, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { toast } from 'sonner';

const InstructorDiscussions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});

  const { data: courses = [] } = useQuery({
    queryKey: ['instructor-courses-list', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').eq('instructor_id', user!.id);
      return data ?? [];
    },
  });

  const courseIds = selectedCourse === 'all' ? courses.map((c: any) => c.id) : [selectedCourse];

  const { data: discussions = [], isLoading } = useQuery({
    queryKey: ['instructor-discussions', courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('discussions')
        .select('*, user_profiles:user_id(full_name, avatar_url), courses:course_id(title)')
        .in('course_id', courseIds)
        .is('parent_id', null)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: allReplies = [] } = useQuery({
    queryKey: ['instructor-discussion-replies', courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('discussions')
        .select('*, user_profiles:user_id(full_name, avatar_url)')
        .in('course_id', courseIds)
        .not('parent_id', 'is', null)
        .order('created_at', { ascending: true });
      return data ?? [];
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ parentId, courseId }: { parentId: string; courseId: string }) => {
      const text = replyText[parentId]?.trim();
      if (!text) throw new Error('Reply cannot be empty');
      const { error } = await supabase.from('discussions').insert({
        content: text,
        course_id: courseId,
        user_id: user!.id,
        parent_id: parentId,
      });
      if (error) throw error;
    },
    onSuccess: (_, { parentId }) => {
      setReplyText((prev) => ({ ...prev, [parentId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['instructor-discussion-replies'] });
      toast.success('Reply posted');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleAnswered = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: boolean }) => {
      const { error } = await supabase.from('discussions').update({ is_answered: !current }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructor-discussions'] }),
  });

  const unansweredCount = discussions.filter((d: any) => !d.is_answered).length;

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold">Discussions</h2>
          <p className="text-sm text-muted-foreground mt-1">{unansweredCount} unanswered thread{unansweredCount !== 1 ? 's' : ''}</p>
        </div>
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Filter by course" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {discussions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted" />
          <p>No discussions yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {discussions.map((d: any) => {
            const replies = allReplies.filter((r: any) => r.parent_id === d.id);
            const isExpanded = expandedThread === d.id;

            return (
              <div key={d.id} className="bg-card border rounded-xl overflow-hidden">
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedThread(isExpanded ? null : d.id)}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold shrink-0">
                    {d.user_profiles?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{d.user_profiles?.full_name || 'Student'}</span>
                      <Badge variant="outline" className="text-[10px]">{(d as any).courses?.title}</Badge>
                      {d.is_answered && <Badge className="text-[10px] bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">Answered</Badge>}
                    </div>
                    <p className="text-sm mt-1 line-clamp-2">{d.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{format(new Date(d.created_at), 'dd MMM yyyy, HH:mm')}</span>
                      <span>{replies.length} repl{replies.length === 1 ? 'y' : 'ies'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); toggleAnswered.mutate({ id: d.id, current: d.is_answered }); }}
                    >
                      <CheckCircle className={`h-4 w-4 ${d.is_answered ? 'text-green-500' : 'text-muted-foreground'}`} />
                    </Button>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t">
                    {replies.length > 0 && (
                      <div className="px-4 pt-3 space-y-3">
                        {replies.map((r: any) => (
                          <div key={r.id} className="flex gap-2 ml-6">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                              {r.user_profiles?.full_name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{r.user_profiles?.full_name}</span>
                                {r.user_id === user?.id && <Badge variant="secondary" className="text-[10px]">You</Badge>}
                                <span className="text-[10px] text-muted-foreground">{format(new Date(r.created_at), 'dd MMM, HH:mm')}</span>
                              </div>
                              <p className="text-sm mt-0.5">{r.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="p-4 flex gap-2">
                      <Textarea
                        value={replyText[d.id] || ''}
                        onChange={(e) => setReplyText((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        placeholder="Write a reply..."
                        rows={2}
                        className="flex-1 resize-none"
                      />
                      <Button
                        size="icon"
                        className="shrink-0 self-end"
                        disabled={!replyText[d.id]?.trim() || replyMutation.isPending}
                        onClick={() => replyMutation.mutate({ parentId: d.id, courseId: d.course_id })}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InstructorDiscussions;
