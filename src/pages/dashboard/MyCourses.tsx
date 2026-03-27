import { useEnrollments, useLessonProgress } from '@/hooks/useEnrollments';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';

const MyCourses = () => {
  const { data: enrollments = [], isLoading } = useEnrollments();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border rounded-xl overflow-hidden">
              <Skeleton className="aspect-video w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">My Courses</h2>
        <Button variant="outline" onClick={() => navigate('/courses')}>Browse More</Button>
      </div>

      {enrollments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted" />
          <h3 className="font-heading font-bold text-lg mb-2">No courses yet</h3>
          <p className="mb-4">Enroll in a course to start learning.</p>
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => navigate('/courses')}>
            Explore Courses
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {enrollments.map((enrollment: any) => (
            <CourseCard key={enrollment.id} enrollment={enrollment} navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
};

// Separate component to enable smart continue per card
function CourseCard({ enrollment, navigate }: { enrollment: any; navigate: any }) {
  const course = enrollment.courses;

  // Get sections & lessons to find next uncompleted
  const { data: sections = [] } = useQuery({
    queryKey: ['course-sections-card', course?.id],
    enabled: !!course?.id && !enrollment.completed_at,
    queryFn: async () => {
      const { data } = await supabase
        .from('course_sections')
        .select('*, lessons(id, sort_order)')
        .eq('course_id', course.id)
        .order('sort_order');
      return (data ?? []).map((s: any) => ({
        ...s,
        lessons: (s.lessons ?? []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      }));
    },
  });

  const { data: progressData = [] } = useLessonProgress(course?.id);
  const completedIds = useMemo(() => new Set(progressData.filter((p: any) => p.completed).map((p: any) => p.lesson_id)), [progressData]);
  const allLessons = useMemo(() => sections.flatMap((s: any) => s.lessons), [sections]);
  const nextLesson = useMemo(() => allLessons.find((l: any) => !completedIds.has(l.id)), [allLessons, completedIds]);

  const handleNavigate = () => {
    if (nextLesson && !enrollment.completed_at) {
      navigate(`/learn/${course?.slug}/${nextLesson.id}`);
    } else {
      navigate(`/courses/${course?.slug}`);
    }
  };

  return (
    <div className="bg-card border rounded-xl overflow-hidden group hover:shadow-md transition-shadow">
      <div className="aspect-video relative overflow-hidden">
        <img
          src={course?.thumbnail_url || '/placeholder.svg'}
          alt={course?.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
        />
        {enrollment.completed_at && (
          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full font-medium">
            Completed ✓
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-heading font-bold text-sm line-clamp-2 mb-2">{course?.title}</h3>
        <p className="text-xs text-muted-foreground mb-3">
          {course?.user_profiles?.full_name || 'Instructor'} · {course?.total_lessons || 0} lessons
        </p>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{enrollment.progress_pct || 0}%</span>
          </div>
          <Progress value={enrollment.progress_pct || 0} className="h-2" />
        </div>
        <Button
          className="w-full mt-3 bg-primary hover:bg-primary/90"
          size="sm"
          onClick={handleNavigate}
        >
          {enrollment.completed_at ? 'Review Course' : enrollment.progress_pct > 0 ? 'Continue Learning' : 'Start Course'}
        </Button>
      </div>
    </div>
  );
}

export default MyCourses;
