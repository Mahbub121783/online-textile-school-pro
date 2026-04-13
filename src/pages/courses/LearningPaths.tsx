import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import SEOHead from '@/components/SEOHead';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';

const LearningPaths = () => {
  const { data: paths = [], isLoading } = useQuery({
    queryKey: ['learning-paths'],
    queryFn: async () => {
      const { data } = await supabase
        .from('learning_paths')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title="Learning Paths | Online Textile School" description="Structured programs to master textile engineering" />
      <Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <section className="bg-gradient-to-br from-primary/10 to-accent/10 py-12 md:py-16">
          <div className="container text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-primary mb-4" />
            <h1 className="text-3xl md:text-4xl font-heading font-bold mb-3">Learning Paths</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">Structured programs designed like university degree tracks. Follow a curated sequence of courses to master textile engineering disciplines.</p>
          </div>
        </section>

        <section className="container py-12">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
            </div>
          ) : paths.length === 0 ? (
            <div className="text-center py-16">
              <GraduationCap className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">Learning paths coming soon!</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {paths.map((path: any) => (
                <Card key={path.id} className="overflow-hidden hover:shadow-lg transition-shadow group">
                  <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 relative overflow-hidden">
                    {path.thumbnail_url ? (
                      <img src={path.thumbnail_url} alt={path.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <GraduationCap className="h-16 w-16 text-primary/40" />
                      </div>
                    )}
                    <Badge className="absolute top-3 right-3 bg-primary">{path.course_ids?.length || 0} Courses</Badge>
                  </div>
                  <CardContent className="p-5 space-y-3">
                    <h3 className="font-heading font-bold text-lg line-clamp-2">{path.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3">{path.description}</p>
                    <div className="flex items-center justify-between pt-2">
                      <span className="font-bold text-primary text-lg">{path.price === 0 ? 'Free' : `৳${path.price}`}</span>
                      <Button asChild size="sm">
                        <Link to={`/learning-paths/${path.slug}`}>View Path</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default LearningPaths;
