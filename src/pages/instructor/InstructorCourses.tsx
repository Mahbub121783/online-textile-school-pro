import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, Eye } from 'lucide-react';

const InstructorCourses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['instructor-all-courses', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('*, categories(name)')
        .eq('instructor_id', user!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  if (isLoading) return <div className="animate-pulse py-12 text-center text-muted-foreground">Loading courses...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">My Courses</h2>
        <Button className="bg-accent hover:bg-accent-hover text-accent-foreground gap-2" onClick={() => navigate('/instructor/courses/new')}>
          <PlusCircle className="h-4 w-4" /> Create Course
        </Button>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">You haven't created any courses yet.</p>
          <Button className="bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => navigate('/instructor/courses/new')}>Create Your First Course</Button>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Students</TableHead>
                <TableHead className="hidden md:table-cell">Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course: any) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img src={course.thumbnail_url || '/placeholder.svg'} alt="" className="w-12 h-8 rounded object-cover hidden sm:block" />
                      <div>
                        <p className="font-medium text-sm line-clamp-1">{course.title}</p>
                        <p className="text-xs text-muted-foreground">★ {course.avg_rating || 0}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{course.categories?.name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={course.is_published ? 'default' : course.review_status === 'pending' ? 'secondary' : 'outline'}>
                      {course.is_published ? 'Published' : course.review_status === 'pending' ? 'Pending' : 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{course.enrollment_count || 0}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm font-medium">৳{course.price || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/instructor/courses/${course.id}`)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/courses/${course.slug}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default InstructorCourses;
