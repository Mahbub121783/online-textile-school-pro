import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GraduationCap } from 'lucide-react';

const GpaWidget = () => {
  const { user } = useAuth();

  const { data: grades = [] } = useQuery({
    queryKey: ['my-grades', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('student_grades' as any)
        .select('*, courses:course_id(title)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  if (grades.length === 0) return null;

  // Calculate CGPA
  const totalWeighted = grades.reduce((sum: number, g: any) => sum + (parseFloat(g.grade_point) * parseFloat(g.credits)), 0);
  const totalCredits = grades.reduce((sum: number, g: any) => sum + parseFloat(g.credits), 0);
  const cgpa = totalCredits > 0 ? (totalWeighted / totalCredits).toFixed(2) : '0.00';

  // Group by semester
  const semesters = [...new Set(grades.map((g: any) => g.semester).filter(Boolean))];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-4 w-4" /> My GPA / CGPA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">{cgpa}</p>
            <p className="text-xs text-muted-foreground">CGPA</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{totalCredits}</p>
            <p className="text-xs text-muted-foreground">Total Credits</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{grades.length}</p>
            <p className="text-xs text-muted-foreground">Courses</p>
          </div>
        </div>
        <div className="space-y-2 max-h-48 overflow-auto">
          {grades.slice(0, 6).map((g: any) => (
            <div key={g.id} className="flex items-center justify-between text-sm p-1.5 rounded hover:bg-muted/50">
              <span className="truncate flex-1 mr-2">{g.courses?.title || 'Course'}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{g.letter_grade}</Badge>
                <span className="text-xs text-muted-foreground">{g.grade_point}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default GpaWidget;
