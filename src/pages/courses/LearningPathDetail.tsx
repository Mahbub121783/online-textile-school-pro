import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';

const LearningPathDetail = () => {
  const { slug } = useParams();
  const { user } = useAuth();

  const { data: path, isLoading } = useQuery({
    queryKey: ['learning-path', slug],
    queryFn: async () => {
      const { data } = await (supabase as any).from('learning_paths').select('*').eq('slug', slug!).single();
      return data;
    },
    enabled: !!slug,
  });

  const courseIds: string[] = path?.course_ids ?? [];

  const { data: courses = [] } = useQuery({
    queryKey: ['path-courses', courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title, slug, thumbnail_url, price, total_lessons, total_duration_minutes').in('id', courseIds);
      const ordered = courseIds.map(id => (data ?? []).find((c: any) => c.id === id)).filter(Boolean);
      return ordered;
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['path-enrollments', user?.id, courseIds],
    enabled: !!user?.id && courseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('enrollments').select('course_id, progress_pct, completed_at').eq('user_id', user!.id).in('course_id', courseIds);
      return data ?? [];
    },
  });

  const completedCount = enrollments.filter((e: any) => e.completed_at).length;
  const overallProgress = courseIds.length > 0 ? Math.round((completedCount / courseIds.length) * 100) : 0;

  if (isLoading) {
    return <div className="min-h-screen flex flex-col"><Header /><main className="flex-1 container py-8"><Skeleton className="h-96" /></main><Footer /></div>;
  }

  if (!path) {
    return <div className="min-h-screen flex flex-col"><Header /><main className="flex-1 container py-8 text-center"><p>Path not found</p></main><Footer /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title={`${path.title} | Learning Path`} />
      <Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <section className="bg-gradient-to-br from-primary/10 to-accent/10 py-12">
          <div className="container max-w-4xl">
            <Badge className="mb-4">Learning Path</Badge>
            <h1 className="text-3xl md:text-4xl font-heading font-bold mb-3">{path.title}</h1>
            <p className="text-muted-foreground mb-6">{path.description}</p>
            <div className="flex items-center gap-6 text-sm">
              <span>{courseIds.length} Courses</span>
              <span className="font-bold text-lg text-primary">{path.price === 0 ? 'Free' : `৳${path.price}`}</span>
            </div>
            {user && courseIds.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Overall Progress</span>
                  <span>{completedCount}/{courseIds.length} completed</span>
                </div>
                <Progress value={overallProgress} className="h-3" />
              </div>
            )}
          </div>
        </section>

        <section className="container max-w-4xl py-8 space-y-4">
          <h2 className="text-xl font-heading font-bold">Course Sequence</h2>
          {courses.map((course: any, idx: number) => {
            const enrollment = enrollments.find((e: any) => e.course_id === course.id);
            const isCompleted = !!enrollment?.completed_at;
            const isEnrolled = !!enrollment;
            return (
              <Card key={course.id} className={`transition-all ${isCompleted ? 'border-primary/50 bg-primary/5' : ''}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                    {isCompleted ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <span>{idx + 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/courses/${course.slug}`} className="font-semibold hover:text-primary transition-colors line-clamp-1">{course.title}</Link>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>{course.total_lessons || 0} lessons</span>
                      <span>{course.total_duration_minutes || 0} min</span>
                      {isEnrolled && !isCompleted && <Badge variant="outline" className="text-xs">In Progress ({enrollment.progress_pct || 0}%)</Badge>}
                    </div>
                  </div>
                  <Button asChild size="sm" variant={isCompleted ? 'outline' : 'default'}>
                    <Link to={`/courses/${course.slug}`}>{isCompleted ? 'Review' : isEnrolled ? 'Continue' : 'View'}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default LearningPathDetail;
