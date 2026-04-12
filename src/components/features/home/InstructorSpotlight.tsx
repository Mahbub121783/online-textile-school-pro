import { BookOpen, Users, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

const InstructorSpotlight = () => {
  const { data: instructors = [], isLoading } = useQuery({
    queryKey: ['home-instructors'],
    queryFn: async () => {
      // Get users with instructor role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instructor');

      if (!roleData || roleData.length === 0) return [];

      const ids = roleData.map((r: any) => r.user_id);

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url, bio')
        .in('id', ids)
        .limit(4);

      if (!profiles) return [];

      // Get course counts and student counts per instructor
      const enriched = await Promise.all(
        profiles.map(async (p: any) => {
          const { count: courseCount } = await supabase
            .from('courses')
            .select('id', { count: 'exact', head: true })
            .eq('instructor_id', p.id)
            .eq('is_published', true);

          const { data: courseIds } = await supabase
            .from('courses')
            .select('id')
            .eq('instructor_id', p.id)
            .eq('is_published', true);

          let studentCount = 0;
          if (courseIds && courseIds.length > 0) {
            const { count } = await supabase
              .from('enrollments')
              .select('id', { count: 'exact', head: true })
              .in('course_id', courseIds.map((c: any) => c.id));
            studentCount = count || 0;
          }

          return { ...p, courseCount: courseCount || 0, studentCount };
        })
      );

      return enriched;
    },
    staleTime: 10 * 60 * 1000,
  });

  if (!isLoading && instructors.length === 0) return null;

  return (
    <section className="py-12 md:py-16 bg-background">
      <div className="container">
        <div className="text-center mb-8">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">Our Expert Instructors</h2>
          <p className="text-muted-foreground">Learn from Bangladesh's leading textile professionals</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {instructors.map((inst: any) => (
              <div key={inst.id} className="bg-card border rounded-lg p-6 text-center hover:shadow-lg transition-all group">
                {inst.avatar_url ? (
                  <img src={inst.avatar_url} alt={inst.full_name} className="w-20 h-20 rounded-full mx-auto mb-4 object-cover" loading="lazy" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-light mx-auto mb-4 flex items-center justify-center text-primary-foreground font-heading font-bold text-xl">
                    {(inst.full_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                )}
                <h3 className="font-heading font-semibold text-foreground">{inst.full_name}</h3>
                {inst.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{inst.bio}</p>}
                <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{inst.studentCount.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{inst.courseCount} courses</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-8 bg-accent/10 border border-accent/20 rounded-lg p-6">
          <h3 className="font-heading font-semibold text-foreground mb-2">Are you a textile expert?</h3>
          <p className="text-sm text-muted-foreground mb-4">Share your knowledge and earn with Online Textile School</p>
          <Button className="bg-accent hover:bg-accent-hover text-accent-foreground" asChild>
            <Link to="/become-instructor">Become an Instructor</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default InstructorSpotlight;
