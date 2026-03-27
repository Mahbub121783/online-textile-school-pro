import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Play, Monitor, Download, BookOpen, ClipboardList, ExternalLink, Lock, Clock, CalendarIcon
} from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  lesson: any;
  materials: any[];
  quizzes: any[];
  assignments: any[];
  onClose: () => void;
}

const LessonPreviewModal = ({ lesson, materials, quizzes, assignments, onClose }: Props) => {
  const getEmbedUrl = (l: any) => {
    if (!l?.video_url) return null;
    const url = l.video_url;
    if (l.video_platform === 'youtube' || url.includes('youtube') || url.includes('youtu.be')) {
      const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      return match ? `https://www.youtube.com/embed/${match[1]}` : url;
    }
    if (l.video_platform === 'vimeo' || url.includes('vimeo')) {
      const match = url.match(/vimeo\.com\/(\d+)/);
      return match ? `https://player.vimeo.com/video/${match[1]}` : url;
    }
    return url;
  };

  const embedUrl = getEmbedUrl(lesson);
  const linkedQuizzes = materials.filter(m => m.material_type === 'quiz');
  const linkedAssignments = materials.filter(m => m.material_type === 'assignment');
  const resources: { name: string; url: string; type: string }[] = Array.isArray(lesson.resources) ? lesson.resources : [];
  const isDripped = lesson.scheduled_unlock_at && new Date(lesson.scheduled_unlock_at) > new Date();

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            Student Preview — {lesson.title}
            <Badge variant="outline" className="text-xs">{lesson.status || 'draft'}</Badge>
          </DialogTitle>
        </DialogHeader>

        {isDripped ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Lock className="h-12 w-12 text-muted-foreground" />
            <h3 className="font-semibold text-lg">Content Locked</h3>
            <p className="text-sm text-muted-foreground">
              Unlocks on {format(new Date(lesson.scheduled_unlock_at), 'PPP p')}
            </p>
          </div>
        ) : (
          <>
            {/* Video area */}
            <div className="aspect-video bg-black w-full relative">
              {embedUrl ? (
                <>
                  <iframe
                    src={embedUrl}
                    className="w-full h-full"
                    allowFullScreen
                    allow="autoplay; encrypted-media"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                  />
                  <div className="absolute inset-0 pointer-events-none" onContextMenu={e => e.preventDefault()} />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Play className="h-16 w-16 opacity-30" />
                </div>
              )}
            </div>

            {/* Content tabs */}
            <div className="p-4">
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                  {linkedQuizzes.length > 0 && <TabsTrigger value="quizzes" className="text-xs">Quizzes ({linkedQuizzes.length})</TabsTrigger>}
                  {linkedAssignments.length > 0 && <TabsTrigger value="assignments" className="text-xs">Assignments ({linkedAssignments.length})</TabsTrigger>}
                  {resources.length > 0 && <TabsTrigger value="resources" className="text-xs">Materials ({resources.length})</TabsTrigger>}
                  {lesson.live_class_url && <TabsTrigger value="live" className="text-xs">Live Class</TabsTrigger>}
                </TabsList>

                <TabsContent value="overview" className="mt-3 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {lesson.duration_minutes > 0 && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{lesson.duration_minutes} min</span>}
                  </div>
                  {lesson.description ? (
                    <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: lesson.description }} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No description provided.</p>
                  )}
                </TabsContent>

                <TabsContent value="quizzes" className="mt-3 space-y-2">
                  {linkedQuizzes.map(m => {
                    const quiz = quizzes.find((q: any) => q.id === m.material_id);
                    return quiz ? (
                      <Card key={m.id}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">{quiz.title}</span>
                          </div>
                          <Button size="sm" disabled className="text-xs gap-1">Start Quiz</Button>
                        </CardContent>
                      </Card>
                    ) : null;
                  })}
                </TabsContent>

                <TabsContent value="assignments" className="mt-3 space-y-2">
                  {linkedAssignments.map(m => {
                    const assign = assignments.find((a: any) => a.id === m.material_id);
                    return assign ? (
                      <Card key={m.id}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">{assign.title}</span>
                          </div>
                          <Button size="sm" disabled className="text-xs gap-1">Start Assignment</Button>
                        </CardContent>
                      </Card>
                    ) : null;
                  })}
                </TabsContent>

                <TabsContent value="resources" className="mt-3 space-y-2">
                  {resources.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 border rounded-md text-sm">
                      <Download className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium flex-1">{r.name}</span>
                      <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" disabled>
                        <Download className="h-3 w-3 mr-1" /> Download
                      </Button>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="live" className="mt-3">
                  <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">Live Class — {lesson.live_class_platform || 'Zoom'}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[300px]">{lesson.live_class_url}</p>
                        </div>
                      </div>
                      <Button size="sm" disabled className="text-xs gap-1">
                        <ExternalLink className="h-3 w-3" /> Join (Preview)
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LessonPreviewModal;
