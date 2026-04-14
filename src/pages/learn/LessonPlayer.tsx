import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMarkLessonComplete, useLessonProgress, useIsEnrolled } from '@/hooks/useEnrollments';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import SecureMediaPlayer from '@/components/media/SecureMediaPlayer';
import {
  ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, Circle,
  FileText, Download, Menu, X, BookOpen, ClipboardList, Monitor, ExternalLink, Lock, Clock, MessageSquare, Send,
  ThumbsUp, Pin, XCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { createNotification } from '@/lib/notifications';

const LessonPlayer = () => {
  const { courseSlug, lessonId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: course } = useQuery({
    queryKey: ['course-by-slug', courseSlug],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('*').eq('slug', courseSlug!).single();
      return data;
    },
    enabled: !!courseSlug,
  });

  const { data: isEnrolled } = useIsEnrolled(course?.id);

  const { data: sections = [] } = useQuery({
    queryKey: ['course-curriculum', course?.id],
    enabled: !!course?.id,
    queryFn: async () => {
      const { data: secs } = await supabase
        .from('course_sections')
        .select('*, lessons(*)')
        .eq('course_id', course!.id)
        .order('sort_order');
      return (secs ?? []).map((s: any) => ({
        ...s,
        lessons: (s.lessons ?? []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      }));
    },
  });

  const { data: progressData = [] } = useLessonProgress(course?.id);
  const markComplete = useMarkLessonComplete();

  const allLessons = useMemo(() => sections.flatMap((s: any) => s.lessons), [sections]);
  const currentLesson = allLessons.find((l: any) => l.id === lessonId);
  const currentIndex = allLessons.findIndex((l: any) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const completedIds = new Set(progressData.filter((p: any) => p.completed).map((p: any) => p.lesson_id));
  const isCurrentCompleted = lessonId ? completedIds.has(lessonId) : false;

  // Fetch linked materials for current lesson
  const { data: lessonMaterials = [] } = useQuery({
    queryKey: ['lesson-materials-player', lessonId],
    enabled: !!lessonId,
    queryFn: async () => {
      const { data } = await supabase.from('lesson_materials').select('*').eq('lesson_id', lessonId!);
      return data ?? [];
    },
  });

  const { data: linkedQuizzes = [] } = useQuery({
    queryKey: ['linked-quizzes', lessonId],
    enabled: lessonMaterials.filter(m => m.material_type === 'quiz').length > 0,
    queryFn: async () => {
      const ids = lessonMaterials.filter(m => m.material_type === 'quiz').map(m => m.material_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from('quizzes').select('*').in('id', ids);
      return data ?? [];
    },
  });

  const { data: linkedAssignments = [] } = useQuery({
    queryKey: ['linked-assignments', lessonId],
    enabled: lessonMaterials.filter(m => m.material_type === 'assignment').length > 0,
    queryFn: async () => {
      const ids = lessonMaterials.filter(m => m.material_type === 'assignment').map(m => m.material_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from('assignments').select('*').in('id', ids);
      return data ?? [];
    },
  });

  const resources: { name: string; url: string; type: string }[] = Array.isArray(currentLesson?.resources) ? currentLesson.resources : [];
  const isDripped = currentLesson?.scheduled_unlock_at && new Date(currentLesson.scheduled_unlock_at) > new Date();

  // Q&A discussions
  const [qaText, setQaText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const queryClient = useQueryClient();

  const [sortBy, setSortBy] = useState<'newest' | 'upvotes'>('newest');

  const { data: discussions = [] } = useQuery({
    queryKey: ['lesson-discussions', course?.id, lessonId, sortBy],
    enabled: !!course?.id && !!lessonId,
    queryFn: async () => {
      let query = supabase
        .from('discussions')
        .select('*, user_profiles:user_id(full_name, avatar_url)')
        .eq('course_id', course!.id)
        .eq('lesson_id', lessonId!)
        .is('parent_id', null);
      if (sortBy === 'upvotes') query = query.order('is_pinned', { ascending: false }).order('upvote_count', { ascending: false });
      else query = query.order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
      const { data } = await query;
      if (!data?.length) return [];
      const ids = data.map(d => d.id);
      const { data: replies } = await supabase
        .from('discussions')
        .select('*, user_profiles:user_id(full_name, avatar_url)')
        .in('parent_id', ids)
        .order('created_at');
      const replyMap = new Map<string, any[]>();
      (replies ?? []).forEach((r: any) => {
        const arr = replyMap.get(r.parent_id) || [];
        arr.push(r);
        replyMap.set(r.parent_id, arr);
      });
      return data.map(d => ({ ...d, replies: replyMap.get(d.id) || [] }));
    },
  });

  // Check which discussions user has upvoted
  const { data: myUpvotes = [] } = useQuery({
    queryKey: ['my-upvotes', lessonId, user?.id],
    enabled: !!user?.id && discussions.length > 0,
    queryFn: async () => {
      const ids = discussions.map((d: any) => d.id);
      const { data } = await supabase
        .from('discussion_upvotes')
        .select('discussion_id')
        .eq('user_id', user!.id)
        .in('discussion_id', ids);
      return (data ?? []).map((u: any) => u.discussion_id);
    },
  });

  const upvotedSet = new Set(myUpvotes);

  const toggleUpvote = async (discussionId: string) => {
    if (!user) return;
    if (upvotedSet.has(discussionId)) {
      await supabase.from('discussion_upvotes').delete().eq('discussion_id', discussionId).eq('user_id', user.id);
    } else {
      await supabase.from('discussion_upvotes').insert({ discussion_id: discussionId, user_id: user.id });
    }
    queryClient.invalidateQueries({ queryKey: ['lesson-discussions'] });
    queryClient.invalidateQueries({ queryKey: ['my-upvotes'] });
  };

  const togglePin = async (discussionId: string, currentlyPinned: boolean) => {
    await supabase.from('discussions').update({ is_pinned: !currentlyPinned } as any).eq('id', discussionId);
    queryClient.invalidateQueries({ queryKey: ['lesson-discussions'] });
  };

  const toggleClose = async (discussionId: string, currentlyClosed: boolean) => {
    await supabase.from('discussions').update({ is_closed: !currentlyClosed } as any).eq('id', discussionId);
    queryClient.invalidateQueries({ queryKey: ['lesson-discussions'] });
  };

  const isInstructor = course?.instructor_id === user?.id;

  const postDiscussion = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: string }) => {
      const { error } = await supabase.from('discussions').insert({
        course_id: course!.id,
        lesson_id: lessonId!,
        user_id: user!.id,
        content,
        parent_id: parentId || null,
      });
      if (error) throw error;

      // If replying as instructor, notify the original poster
      if (parentId) {
        const parent = discussions.find((d: any) => d.id === parentId);
        if (parent && parent.user_id !== user!.id) {
          await createNotification({
            userId: parent.user_id,
            type: 'qa_answered',
            title: 'Your question was answered',
            message: `Your question in "${currentLesson?.title}" received a reply.`,
            link: `/learn/${courseSlug}/${lessonId}`,
          });
          // Mark parent as answered
          await supabase.from('discussions').update({ is_answered: true }).eq('id', parentId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-discussions'] });
      setQaText('');
      setReplyText('');
      setReplyTo(null);
      toast({ title: 'Posted!' });
    },
  });

  // Realtime subscription for lesson discussions
  useEffect(() => {
    if (!course?.id || !lessonId) return;
    const channelName = `lesson-discussions-${course.id}-${lessonId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'discussions',
        filter: `course_id=eq.${course.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['lesson-discussions', course.id, lessonId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [course?.id, lessonId, queryClient]);

  // Save video position periodically
  const handleVideoProgress = useCallback((seconds: number) => {
    if (!lessonId || !user?.id || !course?.id) return;
    // Debounced save — only every 15 seconds
    if (Math.floor(seconds) % 15 === 0 && seconds > 0) {
      supabase.from('lesson_progress').upsert({
        lesson_id: lessonId,
        user_id: user.id,
        last_position_seconds: Math.floor(seconds),
      }, { onConflict: 'lesson_id,user_id' }).then(() => {});
    }
  }, [lessonId, user?.id, course?.id]);

  // Get saved position
  const currentProgress = progressData.find((p: any) => p.lesson_id === lessonId);
  const savedPosition = currentProgress?.last_position_seconds || 0;

  const handleMarkComplete = () => {
    if (!lessonId || !course?.id) return;
    markComplete.mutate(
      { lessonId, courseId: course.id },
      {
        onSuccess: () => {
          toast({ title: 'Lesson completed!', description: nextLesson ? 'Moving to next lesson...' : 'Congratulations!' });
          if (nextLesson) {
            setTimeout(() => navigate(`/learn/${courseSlug}/${nextLesson.id}`), 800);
          }
        },
      }
    );
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center animate-pulse">Loading...</div>;
  if (!user) return <Navigate to={`/auth/login?redirect=/learn/${courseSlug}/${lessonId}`} replace />;

  

  const hasQuizzes = linkedQuizzes.length > 0;
  const hasAssignments = linkedAssignments.length > 0;
  const hasResources = resources.length > 0;
  const hasLiveClass = !!currentLesson?.live_class_url;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="h-12 bg-card border-b flex items-center px-4 gap-3 shrink-0 z-40">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/courses/${courseSlug}`)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-heading font-semibold text-sm truncate flex-1">{course?.title}</h1>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {isDripped ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
              <div className="p-4 rounded-full bg-muted">
                <Lock className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="font-heading text-xl font-bold">Content Locked</h2>
              <p className="text-sm text-muted-foreground">
                This lesson unlocks on {format(new Date(currentLesson.scheduled_unlock_at), 'PPP p')}
              </p>
            </div>
          ) : (
            <>
              {/* Advanced Secure Media Player */}
              <SecureMediaPlayer
                videoUrl={currentLesson?.video_url}
                videoPlatform={currentLesson?.video_platform}
                title={currentLesson?.title}
                onProgress={handleVideoProgress}
                startPosition={savedPosition}
                watermark={user?.email}
              />

              {/* Lesson info & tabs */}
              <div className="p-4 md:p-6 space-y-4">
                {/* Title and mark complete */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-heading text-xl font-bold">{currentLesson?.title || 'Select a lesson'}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      {currentLesson?.duration_minutes > 0 && (
                        <span className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{currentLesson.duration_minutes} min</span>
                      )}
                      {currentLesson?.status && (
                        <Badge variant="outline" className="text-[10px]">{currentLesson.status}</Badge>
                      )}
                    </div>
                  </div>
                  {!isCurrentCompleted && currentLesson && (
                    <Button
                      onClick={handleMarkComplete}
                      disabled={markComplete.isPending}
                      className="bg-accent hover:bg-accent-hover text-accent-foreground shrink-0"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark Complete
                    </Button>
                  )}
                  {isCurrentCompleted && (
                    <span className="text-sm font-medium text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" /> Completed
                    </span>
                  )}
                </div>

                {/* Content Tabs */}
                <Tabs defaultValue="overview">
                  <TabsList className="flex-wrap h-auto">
                    <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                    {hasQuizzes && <TabsTrigger value="quizzes" className="text-xs">Quizzes ({linkedQuizzes.length})</TabsTrigger>}
                    {hasAssignments && <TabsTrigger value="assignments" className="text-xs">Assignments ({linkedAssignments.length})</TabsTrigger>}
                    {hasResources && <TabsTrigger value="materials" className="text-xs">Materials ({resources.length})</TabsTrigger>}
                    {hasLiveClass && <TabsTrigger value="live" className="text-xs">Live Class</TabsTrigger>}
                    <TabsTrigger value="qa" className="text-xs">Q&A ({discussions.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-3 space-y-4">
                    {currentLesson?.description ? (
                      <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: currentLesson.description }} />
                    ) : (
                      <p className="text-sm text-muted-foreground">No description provided.</p>
                    )}
                    {currentLesson?.instructor_notes && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <h4 className="font-medium text-sm mb-1 flex items-center gap-2"><FileText className="h-4 w-4" /> Instructor Notes</h4>
                        <p className="text-sm text-muted-foreground">{currentLesson.instructor_notes}</p>
                      </div>
                    )}
                    {currentLesson?.resource_url && (
                      <a href={currentLesson.resource_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                        <Download className="h-4 w-4" /> Download Resources
                      </a>
                    )}
                  </TabsContent>

                  <TabsContent value="quizzes" className="mt-3 space-y-2">
                    {linkedQuizzes.map((quiz: any) => (
                      <Card key={quiz.id} className="hover:shadow-sm transition-shadow">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-md bg-primary/10">
                              <BookOpen className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{quiz.title}</p>
                              {quiz.time_limit_minutes && <p className="text-xs text-muted-foreground">{quiz.time_limit_minutes} min time limit</p>}
                            </div>
                          </div>
                          <Button size="sm" className="bg-accent hover:bg-accent-hover text-accent-foreground gap-1" onClick={() => navigate(`/quiz/${quiz.id}`)}>
                            Start Quiz
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="assignments" className="mt-3 space-y-2">
                    {linkedAssignments.map((assign: any) => (
                      <Card key={assign.id} className="hover:shadow-sm transition-shadow">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-md bg-primary/10">
                              <ClipboardList className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{assign.title}</p>
                              {assign.due_days && <p className="text-xs text-muted-foreground">Due in {assign.due_days} days</p>}
                            </div>
                          </div>
                          <Button size="sm" className="bg-accent hover:bg-accent-hover text-accent-foreground gap-1" onClick={() => navigate(`/assignment/${assign.id}`)}>
                            Start Assignment
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="materials" className="mt-3 space-y-2">
                    {resources.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="p-2 rounded-md bg-muted">
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.name}</p>
                          <Badge variant="outline" className="text-[10px] mt-0.5">{r.type}</Badge>
                        </div>
                        <a href={r.url} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm" className="text-xs gap-1">
                            <Download className="h-3 w-3" /> Download
                          </Button>
                        </a>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="live" className="mt-3">
                    <Card className="border-primary/20">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-primary/10">
                            <Monitor className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">Live Class — {currentLesson?.live_class_platform || 'Zoom'}</p>
                            <p className="text-xs text-muted-foreground">Click to join the live session</p>
                          </div>
                        </div>
                        <a href={currentLesson?.live_class_url} target="_blank" rel="noreferrer">
                          <Button size="sm" className="bg-accent hover:bg-accent-hover text-accent-foreground gap-1">
                            <ExternalLink className="h-3 w-3" /> Join Now
                          </Button>
                        </a>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Q&A Tab */}
                  <TabsContent value="qa" className="mt-3 space-y-4">
                    {/* Post new question */}
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Ask a question about this lesson..."
                        value={qaText}
                        onChange={(e) => setQaText(e.target.value)}
                        className="min-h-[60px]"
                      />
                      <div className="flex items-center justify-between">
                        <Button
                          size="sm"
                          disabled={!qaText.trim() || postDiscussion.isPending}
                          onClick={() => postDiscussion.mutate({ content: qaText.trim() })}
                          className="bg-accent hover:bg-accent/90 text-accent-foreground"
                        >
                          <Send className="h-3 w-3 mr-1" /> Post Question
                        </Button>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant={sortBy === 'newest' ? 'secondary' : 'ghost'} className="text-xs h-7" onClick={() => setSortBy('newest')}>Newest</Button>
                          <Button size="sm" variant={sortBy === 'upvotes' ? 'secondary' : 'ghost'} className="text-xs h-7" onClick={() => setSortBy('upvotes')}>Top</Button>
                        </div>
                      </div>
                    </div>

                    {discussions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted" />
                        <p className="text-sm">No questions yet. Be the first to ask!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {discussions.map((disc: any) => (
                          <div key={disc.id} className={`border rounded-lg p-4 space-y-3 ${disc.is_pinned ? 'border-primary/40 bg-primary/5' : ''} ${disc.is_closed ? 'opacity-60' : ''}`}>
                            <div className="flex items-start gap-3">
                              {/* Upvote button */}
                              <button onClick={() => toggleUpvote(disc.id)} className="flex flex-col items-center gap-0.5 pt-1">
                                <ThumbsUp className={`h-4 w-4 ${upvotedSet.has(disc.id) ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                                <span className="text-[10px] font-medium">{disc.upvote_count || 0}</span>
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium">{disc.user_profiles?.full_name || 'Student'}</span>
                                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(disc.created_at), { addSuffix: true })}</span>
                                  {disc.is_answered && <Badge variant="outline" className="text-[10px] text-green-600 border-green-600">Answered</Badge>}
                                  {disc.is_pinned && <Badge variant="outline" className="text-[10px] text-primary border-primary">Pinned</Badge>}
                                  {disc.is_closed && <Badge variant="outline" className="text-[10px]">Closed</Badge>}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{disc.content}</p>
                                {/* Instructor controls */}
                                {isInstructor && (
                                  <div className="flex gap-1 mt-2">
                                    <Button size="sm" variant="ghost" className="text-[10px] h-6 px-2" onClick={() => togglePin(disc.id, disc.is_pinned)}>
                                      <Pin className="h-3 w-3 mr-0.5" /> {disc.is_pinned ? 'Unpin' : 'Pin'}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="text-[10px] h-6 px-2" onClick={() => toggleClose(disc.id, disc.is_closed)}>
                                      <XCircle className="h-3 w-3 mr-0.5" /> {disc.is_closed ? 'Reopen' : 'Close'}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Replies */}
                            {disc.replies?.length > 0 && (
                              <div className="ml-10 space-y-2">
                                {disc.replies.map((reply: any) => (
                                  <div key={reply.id} className="flex items-start gap-2 bg-muted/30 rounded-md p-2">
                                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold shrink-0">
                                      {reply.user_profiles?.full_name?.[0]?.toUpperCase() || 'R'}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs font-medium">{reply.user_profiles?.full_name || 'User'}</span>
                                        <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-0.5">{reply.content}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Reply input - only if not closed */}
                            {!disc.is_closed && (
                              replyTo === disc.id ? (
                                <div className="ml-10 flex gap-2">
                                  <Textarea
                                    placeholder="Write a reply..."
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    className="min-h-[40px] text-xs flex-1"
                                  />
                                  <div className="flex flex-col gap-1">
                                    <Button size="sm" variant="outline" className="text-xs" onClick={() => { setReplyTo(null); setReplyText(''); }}>Cancel</Button>
                                    <Button
                                      size="sm"
                                      className="text-xs bg-accent hover:bg-accent/90 text-accent-foreground"
                                      disabled={!replyText.trim() || postDiscussion.isPending}
                                      onClick={() => postDiscussion.mutate({ content: replyText.trim(), parentId: disc.id })}
                                    >Reply</Button>
                                  </div>
                                </div>
                              ) : (
                                <Button size="sm" variant="ghost" className="ml-10 text-xs text-muted-foreground" onClick={() => setReplyTo(disc.id)}>
                                  Reply
                                </Button>
                              )
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                {/* Navigation */}
                <div className="flex items-center justify-between border-t pt-4">
                  <Button variant="outline" disabled={!prevLesson} onClick={() => prevLesson && navigate(`/learn/${courseSlug}/${prevLesson.id}`)}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {currentIndex + 1} / {allLessons.length}
                  </span>
                  <Button variant="outline" disabled={!nextLesson} onClick={() => nextLesson && navigate(`/learn/${courseSlug}/${nextLesson.id}`)}>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar curriculum */}
        {sidebarOpen && (
          <aside className="w-80 border-l bg-card overflow-y-auto shrink-0 hidden lg:block">
            <div className="p-4">
              <h3 className="font-heading font-bold text-sm mb-3">Course Content</h3>
              <p className="text-xs text-muted-foreground mb-4">
                {completedIds.size}/{allLessons.length} completed
              </p>
              <div className="space-y-1">
                {sections.map((section: any) => (
                  <Collapsible key={section.id} defaultOpen>
                    <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-2 text-sm font-medium rounded hover:bg-muted">
                      <span className="truncate text-left">{section.title}</span>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-2 space-y-0.5">
                        {section.lessons.map((lesson: any) => {
                          const isActive = lesson.id === lessonId;
                          const done = completedIds.has(lesson.id);
                          const locked = lesson.scheduled_unlock_at && new Date(lesson.scheduled_unlock_at) > new Date();
                          return (
                            <button
                              key={lesson.id}
                              onClick={() => !locked && navigate(`/learn/${courseSlug}/${lesson.id}`)}
                              disabled={!!locked}
                              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs text-left transition-colors ${
                                isActive ? 'bg-primary/10 text-primary font-medium' : locked ? 'opacity-50 cursor-not-allowed text-muted-foreground' : 'hover:bg-muted text-muted-foreground'
                              }`}
                            >
                              {locked ? (
                                <Lock className="h-3.5 w-3.5 shrink-0" />
                              ) : done ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                              ) : (
                                <Circle className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <span className="truncate">{lesson.title}</span>
                              {lesson.duration_minutes > 0 && (
                                <span className="ml-auto text-[10px] opacity-60">{lesson.duration_minutes}m</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default LessonPlayer;
