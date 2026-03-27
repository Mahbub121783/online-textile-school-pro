import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, Users, DollarSign, TrendingUp, Star, FileQuestion } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const InstructorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: courses = [] } = useQuery({
    queryKey: ['instructor-courses', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title, slug, enrollment_count, avg_rating, price, is_published, review_status, thumbnail_url')
        .eq('instructor_id', user!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['instructor-enrollments', user?.id],
    enabled: !!user && courses.length > 0,
    queryFn: async () => {
      const courseIds = courses.map((c: any) => c.id);
      const { data } = await supabase
        .from('enrollments')
        .select('id, course_id, enrolled_at')
        .in('course_id', courseIds);
      return data ?? [];
    },
  });

  const totalStudents = enrollments.length;
  const publishedCount = courses.filter((c: any) => c.is_published).length;
  const avgRating = courses.length
    ? (courses.reduce((s: number, c: any) => s + (c.avg_rating || 0), 0) / courses.length).toFixed(1)
    : '0.0';
  const estRevenue = enrollments.reduce((sum: number, e: any) => {
    const course = courses.find((c: any) => c.id === e.course_id);
    return sum + (course?.price || 0) * 0.7;
  }, 0);

  const stats = [
    { label: 'Total Courses', value: courses.length, icon: BookOpen, color: 'text-primary' },
    { label: 'Published', value: publishedCount, icon: TrendingUp, color: 'text-accent' },
    { label: 'Total Students', value: totalStudents, icon: Users, color: 'text-primary' },
    { label: 'Avg. Rating', value: avgRating, icon: Star, color: 'text-accent' },
    { label: 'Est. Revenue', value: `৳${Math.round(estRevenue).toLocaleString()}`, icon: DollarSign, color: 'text-primary' },
    { label: 'Pending Review', value: courses.filter((c: any) => c.review_status === 'pending').length, icon: FileQuestion, color: 'text-accent' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">Instructor Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border rounded-xl p-4 md:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="font-heading text-xl md:text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent courses */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold text-lg">Your Courses</h3>
          <button onClick={() => navigate('/instructor/courses/new')} className="text-sm text-primary hover:underline font-medium">+ New Course</button>
        </div>
        {courses.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No courses yet. Create your first course!</p>
        ) : (
          <div className="space-y-3">
            {courses.slice(0, 5).map((course: any) => (
              <div key={course.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate(`/instructor/courses/${course.id}`)}>
                <img src={course.thumbnail_url || '/placeholder.svg'} alt={course.title} className="w-16 h-12 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{course.title}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{course.enrollment_count || 0} students</span>
                    <span>★ {course.avg_rating || 0}</span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  course.is_published ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' :
                  course.review_status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {course.is_published ? 'Published' : course.review_status === 'pending' ? 'Pending' : 'Draft'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InstructorDashboard;
