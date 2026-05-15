import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GraduationCap, Quote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import SEOHead from '@/components/SEOHead';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';

const AlumniPage = () => {
  const { data: stories = [], isLoading } = useQuery({
    queryKey: ['success-stories-public'],
    queryFn: async () => {
      const { data } = await supabase.from('success_stories').select('id, name, job_title, story, photo_url, is_featured, created_at').order('created_at', { ascending: false }).limit(60);
      return data ?? [];
    },
  });

  const featured = stories.filter((s: any) => s.is_featured);
  const others = stories.filter((s: any) => !s.is_featured);

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title="Alumni Success Stories | Online Textile School" description="Inspiring stories from our graduates shaping the textile industry" />
      <Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <section className="bg-gradient-to-br from-primary/10 to-accent/10 py-12 md:py-16">
          <div className="container text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-primary mb-4" />
            <h1 className="text-3xl md:text-4xl font-heading font-bold mb-3">Alumni Success Stories</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">Discover how our graduates are making an impact in the textile industry worldwide.</p>
          </div>
        </section>

        <section className="container py-12">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-72 rounded-xl" />)}</div>
          ) : stories.length === 0 ? (
            <div className="text-center py-16"><GraduationCap className="h-16 w-16 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground text-lg">Success stories coming soon!</p></div>
          ) : (
            <div className="space-y-10">
              {featured.length > 0 && (
                <div className="grid gap-6 md:grid-cols-2">
                  {featured.map((story: any) => (
                    <Card key={story.id} className="overflow-hidden border-primary/20">
                      <CardContent className="p-6 space-y-4">
                        <Quote className="h-8 w-8 text-primary/30" />
                        <p className="text-lg leading-relaxed italic">{story.story}</p>
                        <div className="flex items-center gap-4 pt-4 border-t">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={story.photo_url} />
                            <AvatarFallback>{story.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-heading font-bold">{story.name}</p>
                            <p className="text-sm text-muted-foreground">{story.job_title}</p>
                            <div className="flex gap-2 mt-1">
                              {story.course_title && <Badge variant="outline" className="text-xs">{story.course_title}</Badge>}
                              {story.graduation_year && <Badge variant="secondary" className="text-xs">Class of {story.graduation_year}</Badge>}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {others.length > 0 && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {others.map((story: any) => (
                    <Card key={story.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={story.photo_url} />
                            <AvatarFallback>{story.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{story.name}</p>
                            <p className="text-xs text-muted-foreground">{story.job_title}</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-4">{story.story}</p>
                        <div className="flex gap-2 flex-wrap">
                          {story.course_title && <Badge variant="outline" className="text-xs">{story.course_title}</Badge>}
                          {story.graduation_year && <Badge variant="secondary" className="text-xs">{story.graduation_year}</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default AlumniPage;
