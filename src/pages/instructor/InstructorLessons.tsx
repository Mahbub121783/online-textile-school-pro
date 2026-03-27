import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, FileText, Clock, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

const InstructorLessons = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['instructor-lessons', user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Get instructor's courses
      const { data: courses } = await supabase.from('courses').select('id').eq('instructor_id', user!.id);
      if (!courses?.length) return [];
      const courseIds = courses.map(c => c.id);
      const { data: sections } = await supabase.from('course_sections').select('id, title, course_id, courses!course_sections_course_id_fkey(title)').in('course_id', courseIds);
      if (!sections?.length) return [];
      const sectionIds = sections.map(s => s.id);
      const { data: lessonsData } = await supabase.from('lessons').select('*').in('section_id', sectionIds).order('created_at', { ascending: false });
      
      // Map section info to lessons
      const sectionMap = new Map(sections.map(s => [s.id, s]));
      return (lessonsData ?? []).map((l: any) => ({
        ...l,
        section: sectionMap.get(l.section_id),
      }));
    },
  });

  const filtered = lessons.filter((l: any) => l.title.toLowerCase().includes(search.toLowerCase()));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">Lessons Library</h2>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search lessons..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-16 w-16 mx-auto mb-4 text-muted" />
          <h3 className="font-heading font-bold text-lg mb-2">No lessons found</h3>
          <p>Create lessons from the Course Builder curriculum tab.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((lesson: any) => (
            <div key={lesson.id} className="bg-card border rounded-lg p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
              <div className="p-2 rounded-md bg-primary/10 shrink-0">
                {lesson.lesson_type === 'video' ? <Play className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{lesson.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {(lesson.section?.courses as any)?.title} → {lesson.section?.title}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lesson.duration_minutes > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {lesson.duration_minutes}m
                  </span>
                )}
                <Badge variant={lesson.status === 'published' ? 'default' : 'secondary'} className="text-xs">
                  {lesson.status || 'draft'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InstructorLessons;
