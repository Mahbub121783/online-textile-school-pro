import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { ArrowRight, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LearningPathsPreview = () => {
  const { data: paths = [] } = useQuery({
    queryKey: ['learning-paths-home'],
    queryFn: async () => {
      const { data } = await supabase
        .from('learning_paths')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  if (paths.length === 0) return null;

  return (
    <section className="py-12">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-heading text-2xl md:text-3xl font-bold">Learning Paths</h2>
            <p className="text-muted-foreground mt-1">Structured roadmaps to master textile skills</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/learning-paths">Explore All <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {paths.map((path) => (
            <Link key={path.id} to={`/learning-paths/${path.slug}`} className="group">
              <div className="bg-card border rounded-xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1">
                {path.thumbnail_url ? (
                  <img src={path.thumbnail_url} alt={path.title} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                    <Route className="h-12 w-12 text-primary/30" />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="font-heading font-bold text-lg group-hover:text-primary transition-colors line-clamp-2">{path.title}</h3>
                  {path.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{path.description}</p>
                  )}
                  {path.course_ids && (
                    <p className="text-xs text-muted-foreground mt-2">{path.course_ids.length} courses</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LearningPathsPreview;
