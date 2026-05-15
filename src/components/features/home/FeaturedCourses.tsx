import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Clock, Users, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCartStore } from '@/stores/cartStore';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const FeaturedCourses = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const addItem = useCartStore((s) => s.addItem);

  const { data: categories = [] } = useQuery({
    queryKey: ['home-course-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id, name').order('sort_order').limit(6);
      return data ?? [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 0,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['home-featured-courses'],
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title, slug, price, discount_price, avg_rating, enrollment_count, total_duration_minutes, difficulty_level, thumbnail_url, category_id, categories(name), user_profiles!courses_instructor_id_fkey(full_name), created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(8);
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
    retry: 0,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const catNames = ['All', ...categories.map((c: any) => c.name)];

  const filtered = activeCategory === 'All'
    ? courses
    : courses.filter((c: any) => (c.categories as any)?.name === activeCategory);

  return (
    <section className="py-12 md:py-16 bg-background min-h-[400px]">
      <div className="container">
        <div className="text-center mb-8">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">Featured Courses</h2>
          <p className="text-muted-foreground">Build your textile career with expert-led courses</p>
        </div>
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {catNames.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? 'default' : 'outline'}
              size="sm"
              className={`shrink-0 text-xs ${activeCategory === cat ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No courses found in this category yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {filtered.map((course: any) => {
              const finalPrice = course.discount_price ?? course.price ?? 0;
              const instructorName = (course.user_profiles as any)?.full_name || 'Instructor';
              const catName = (course.categories as any)?.name || '';
              const dur = course.total_duration_minutes || 0;
              const durationStr = dur >= 60 ? `${Math.floor(dur / 60)}h ${dur % 60}m` : `${dur}m`;
              const isFree = finalPrice === 0;

              return (
                <div key={course.id} className="group bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="relative aspect-video bg-secondary">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <span className="text-4xl opacity-30">🧵</span>
                      </div>
                    )}
                    {isFree && <Badge className="absolute top-2 left-2 text-xs bg-success text-white">Free</Badge>}
                    {course.difficulty_level && (
                      <Badge variant="secondary" className="absolute top-2 right-2 text-xs capitalize">{course.difficulty_level}</Badge>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">{catName}</p>
                    <Link to={`/courses/${course.slug}`}>
                      <h3 className="font-heading font-semibold text-sm leading-tight line-clamp-2 hover:text-primary transition-colors">{course.title}</h3>
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {(course.avg_rating ?? 0) > 0 && (
                        <div className="flex items-center gap-1"><Star className="h-3 w-3 fill-warning text-warning" />{Number(course.avg_rating).toFixed(1)}</div>
                      )}
                      <span>•</span>
                      <div className="flex items-center gap-1"><Users className="h-3 w-3" />{course.enrollment_count || 0}</div>
                      <span>•</span>
                      <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{durationStr}</div>
                    </div>
                    <p className="text-xs text-muted-foreground">by {instructorName}</p>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-foreground">
                          {isFree ? 'Free' : `৳${Number(finalPrice).toLocaleString()}`}
                        </span>
                        {course.discount_price && (
                          <span className="text-xs text-muted-foreground line-through">৳{Number(course.price).toLocaleString()}</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs group-hover:bg-accent group-hover:text-accent-foreground group-hover:border-accent transition-colors"
                        onClick={() => addItem({ id: course.id, type: 'course', title: course.title, price: course.price || 0, discount_price: course.discount_price ?? undefined })}
                      >
                        <ShoppingCart className="h-3 w-3 mr-1" />Add
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-center mt-8">
          <Button variant="outline" size="lg" asChild>
            <Link to="/courses">View All Courses →</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedCourses;
