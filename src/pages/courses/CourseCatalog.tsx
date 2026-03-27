import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Search, Star, Clock, Users, ShoppingCart, SlidersHorizontal, X, Play, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useCartStore } from '@/stores/cartStore';
import { COURSE_CATEGORIES, DIFFICULTY_LEVELS } from '@/lib/constants';
import SEOHead from '@/components/SEOHead';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';

const CourseCatalog = () => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch real courses
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['catalog-courses'],
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title, slug, price, discount_price, avg_rating, enrollment_count, total_duration_minutes, total_lessons, difficulty_level, thumbnail_url, category_id, categories(name), user_profiles!courses_instructor_id_fkey(full_name)')
        .eq('is_published', true)
        .order('enrollment_count', { ascending: false });
      return data ?? [];
    },
  });

  // Fetch user enrollments
  const { data: enrolledCourseIds = new Set<string>() } = useQuery({
    queryKey: ['user-enrollments-set', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('user_id', user!.id);
      return new Set((data ?? []).map((e: any) => e.course_id));
    },
  });

  const filtered = courses.filter((c: any) => {
    const catName = (c.categories as any)?.name || '';
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedCategory && catName !== selectedCategory) return false;
    if (selectedDifficulty && c.difficulty_level !== selectedDifficulty.toLowerCase()) return false;
    return true;
  });

  const FilterSidebar = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading font-semibold text-sm mb-3">Category</h3>
        <div className="space-y-2">
          {COURSE_CATEGORIES.map((cat) => (
            <div key={cat.slug} className="flex items-center gap-2">
              <Checkbox id={cat.slug} checked={selectedCategory === cat.name} onCheckedChange={() => setSelectedCategory(selectedCategory === cat.name ? '' : cat.name)} />
              <Label htmlFor={cat.slug} className="text-sm cursor-pointer">{cat.name}</Label>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-heading font-semibold text-sm mb-3">Difficulty</h3>
        <div className="space-y-2">
          {DIFFICULTY_LEVELS.map((level) => (
            <div key={level} className="flex items-center gap-2">
              <Checkbox id={level} checked={selectedDifficulty === level} onCheckedChange={() => setSelectedDifficulty(selectedDifficulty === level ? '' : level)} />
              <Label htmlFor={level} className="text-sm cursor-pointer">{level}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title="Course Catalog"
        description="Browse textile engineering courses in Spinning, Weaving, Dyeing, Knitting, Garments Technology and more. Learn from industry experts at Online Textile School."
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Course Catalog — Online Textile School',
          description: 'Browse textile engineering courses in Spinning, Weaving, Dyeing, Knitting, and more.',
          url: window.location.href,
          provider: { '@type': 'EducationalOrganization', name: 'Online Textile School' },
        }}
      />
      <UtilityBar />
      <Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="bg-secondary py-4">
          <div className="container">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-primary">Home</Link>
              <span>/</span>
              <span className="text-foreground">Courses</span>
            </div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mt-2">Course Catalog</h1>
          </div>
        </div>

        <div className="container py-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search courses..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="lg:hidden" onClick={() => setFiltersOpen(!filtersOpen)}>
                <SlidersHorizontal className="h-4 w-4 mr-1" />Filters
              </Button>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-6">
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-20 bg-card border rounded-lg p-4">
                <FilterSidebar />
              </div>
            </aside>

            {filtersOpen && (
              <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setFiltersOpen(false)}>
                <div className="absolute right-0 top-0 h-full w-80 bg-card border-l p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-heading font-bold">Filters</h2>
                    <Button variant="ghost" size="icon" onClick={() => setFiltersOpen(false)}><X className="h-4 w-4" /></Button>
                  </div>
                  <FilterSidebar />
                </div>
              </div>
            )}

            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-4">{filtered.length} courses found</p>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-72 rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map((course: any) => {
                    const finalPrice = course.discount_price ?? course.price ?? 0;
                    const isEnrolled = enrolledCourseIds instanceof Set && enrolledCourseIds.has(course.id);
                    const catName = (course.categories as any)?.name || '';
                    const instructorName = (course.user_profiles as any)?.full_name || 'Instructor';
                    const dur = course.total_duration_minutes || 0;
                    const durationStr = dur >= 60 ? `${Math.floor(dur / 60)}h ${dur % 60}m` : `${dur}m`;

                    return (
                      <div key={course.id} className="group bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1">
                        <div className="relative aspect-video bg-secondary overflow-hidden cursor-pointer" onClick={() => navigate(`/courses/${course.slug}`)}>
                          {course.thumbnail_url ? (
                            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"><span className="text-3xl opacity-30">📚</span></div>
                          )}
                          {isEnrolled && (
                            <Badge className="absolute top-2 left-2 text-xs bg-green-600 text-white border-0">
                              <CheckCircle className="h-3 w-3 mr-1" /> Enrolled
                            </Badge>
                          )}
                          {!isEnrolled && finalPrice === 0 && (
                            <Badge className="absolute top-2 left-2 text-xs bg-primary text-primary-foreground">Free</Badge>
                          )}
                        </div>
                        <div className="p-4 space-y-2">
                          <p className="text-xs text-muted-foreground">{catName}</p>
                          <Link to={`/courses/${course.slug}`}><h3 className="font-heading font-semibold text-sm line-clamp-2 hover:text-primary">{course.title}</h3></Link>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {(course.avg_rating ?? 0) > 0 && <><Star className="h-3 w-3 fill-warning text-warning" />{Number(course.avg_rating).toFixed(1)} •</>}
                            <Users className="h-3 w-3" />{course.enrollment_count || 0} •
                            <Clock className="h-3 w-3" />{durationStr}
                          </div>
                          <p className="text-xs text-muted-foreground">by {instructorName}</p>
                          <div className="flex items-center justify-between pt-2 border-t">
                            {isEnrolled ? (
                              <>
                                <span className="text-xs text-green-600 font-semibold">✓ Purchased</span>
                                <Button size="sm" className="h-8 text-xs bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => navigate(`/courses/${course.slug}`)}>
                                  <Play className="h-3 w-3 mr-1" />Continue
                                </Button>
                              </>
                            ) : (
                              <>
                                <div>
                                  <span className="font-heading font-bold">{finalPrice === 0 ? 'Free' : `৳${Number(finalPrice).toLocaleString()}`}</span>
                                  {course.discount_price && <span className="text-xs text-muted-foreground line-through ml-2">৳{Number(course.price).toLocaleString()}</span>}
                                </div>
                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addItem({ id: course.id, type: 'course', title: course.title, price: course.price || 0, discount_price: course.discount_price ?? undefined })}>
                                  <ShoppingCart className="h-3 w-3 mr-1" />Add
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default CourseCatalog;
